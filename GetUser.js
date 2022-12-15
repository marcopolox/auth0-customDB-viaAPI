async function getByEmail(email, callback) {
    // This script should retrieve a user profile from your existing database,
    // without authenticating the user.
    // It is used to check if a user exists before executing flows that do not
    // require authentication (signup and password reset).
    //
    // There are three ways this script can finish:
    // 1. A user was successfully found. The profile should be in the following
    // format: https://auth0.com/docs/users/normalized/auth0/normalized-user-profile-schema.
    //     callback(null, profile);
    // 2. A user was not found
    //     callback(null);
    // 3. Something went wrong while trying to reach your database:
    //     callback(new Error("my error message"));
  
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
  
    const getUserOptions = {
          url: configuration.API_ENDPOINT+"/"+email,
          method: "GET",
          json: true,
          data: {
              email: email
          },
          headers: {
              "Authorization": "Bearer " + token
          }
      };

    await axios(getUserOptions)
    .then(function (response) {
      if(Object.keys(response.data).length === 0) {
        console.log("empty response");
        return callback(null,null);
      }
      let profile = profile = {
          user_id: email,
          email: email
        };
        return callback(null, profile);
    })
    .catch(function (error) {
      //console.log(error);
      return callback(new Error("User not found."));
    });
  }
  