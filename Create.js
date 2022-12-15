async function create(user, callback) {
    // This script should create a user entry in your existing database. It will
    // be executed when a user attempts to sign up, or when a user is created
    // through the Auth0 dashboard or API.
    // When this script has finished executing, the Login script will be
    // executed immediately afterwards, to verify that the user was created
    // successfully.
    //
    // The user object will always contain the following properties:
    // * email: the user's email
    // * password: the password entered by the user, in plain text
    // * tenant: the name of this Auth0 account
    // * client_id: the client ID of the application where the user signed up, or
    //              API key if created through the API or Auth0 dashboard
    // * connection: the name of this database connection
    //
    // There are three ways this script can finish:
    // 1. A user was successfully created
    //     callback(null);
    // 2. This user already exists in your database
    //     callback(new ValidationError("user_exists", "my error message"));
    // 3. Something went wrong while trying to reach your database
    //     callback(new Error("my error message"));
  
    const bcrypt = require('bcrypt');
    const axios = require('axios');
    var ManagementClient = require('auth0@2.17.0').ManagementClient;
    var _ = require('lodash');
    
    /*** Get Access Token via CC flow and pass it to the API in the header ***/
    async function getAccessToken() {
      if (configuration.AT_TOKEN &&
          configuration.AT_TOKEN_RENEW_AT &&
          configuration.AT_TOKEN_RENEW_AT > Date.now()) {
        console.log("Access token is valid...cache hit!");
        return configuration.AT_TOKEN;
      }
      else {
        console.log("Access token expired or not found...cache miss!, getting new token");
  
        const auth0LoginOpts = {
          url: configuration.MANAGEMENT_TOKEN_URL,
          method: "POST",
          json: true,
          data: {
            grant_type: "client_credentials",
            client_id: configuration.CLIENT_ID,
            client_secret: configuration.CLIENT_SECRET,
            audience: configuration.MANAGEMENT_API_AUDIENCE
          }
        };
  
        console.log("getting token for ManagementClient");
        const auth0LoginBody = await axios(auth0LoginOpts);
        //console.log("auth0LoginBody: ",auth0LoginBody);
        let management = new ManagementClient({
          token: auth0LoginBody.data.access_token,
          domain: configuration.AUTH0_DOMAIN
        });
  
        const localDBScriptsLoginOpts = {
          url: configuration.SELF_TOKEN_URL,
          method: "POST",
          json: true,
          data: {
            grant_type: "client_credentials",
            client_id: configuration.CLIENT_ID,
            client_secret: configuration.CLIENT_SECRET,
            audience: configuration.SELF_API_AUDIENCE
          }
        };
              
        console.log("getting token for self app");
        const selfLoginBody = await axios(localDBScriptsLoginOpts);
        //console.log(selfLoginBody);
        const connections = await management.connections.getAll();
        var connection = _.find(connections, { name: configuration.CONNECTION_NAME, strategy: 'auth0' });
        if (connection) {
          console.log("Found connection: " + connection.name + ". Updating...");
          var subset = _.pick(connection, ['options']);
          subset.options.bareConfiguration = {};
          subset.options.bareConfiguration.at_token = selfLoginBody.data.access_token;
          // expires_in is in milliseconds, but leave a 20% buffer on refresh time just in case
          subset.options.bareConfiguration.at_token_renew_at = (Date.now() + (800 * selfLoginBody.data.expires_in)).toString();
          var identity = _.pick(connection, ['id']);
          await management.connections.update(identity, subset);
          return selfLoginBody.data.access_token;
        }
      }
    }
  
    /*************************************************************************/
    
    const token = await getAccessToken();
    //console.log("Token to send to api :",token);
    
    let encryptedpwd = null;
    await bcrypt.hash(user.password, 10)
    .then(function(hash) {
      console.log("hash: ",hash);
        encryptedpwd = hash;
    });
    //console.log("encryptedpwd: ",encryptedpwd);
    const apiCreateOptions = {
          url: configuration.API_ENDPOINT,
          method: "PUT",
          json: true,
          data: {
              email: user.email,
              password: encryptedpwd
          },
          headers: {
              "Authorization": "Bearer " + token
          }
      };
    await axios(apiCreateOptions)
    .then(function (response) {
      console.log(response);
      return callback(null);
    })
    .catch(function (error) {
      console.log(error);
      return callback(new Error(error));
    }); 
  }
  