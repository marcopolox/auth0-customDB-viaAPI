async function verify(email, callback) {
    // This script should mark the current user's email address as verified in
    // your database.
    // It is executed whenever a user clicks the verification link sent by email.
    // These emails can be customized at https://manage.auth0.com/#/emails.
    // It is safe to assume that the user's email already exists in your database,
    // because verification emails, if enabled, are sent immediately after a
    // successful signup.
    //
    // There are two ways that this script can finish:
    // 1. The user's email was verified successfully
    //     callback(null, true);
    // 2. Something went wrong while trying to reach your database:
    //     callback(new Error("my error message"));
    //
    // If an error is returned, it will be passed to the query string of the page
    // where the user is being redirected to after clicking the verification link.
    // For example, returning `callback(new Error("error"))` and redirecting to
    // https://example.com would redirect to the following URL:
    //     https://example.com?email=alice%40example.com&message=error&success=false
  
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
      // Return true in callback if update succeeded
      console.log("response: ",response);
        return callback(null, true);
    })
    .catch(function (error) {
      //console.log(error);
      return callback(new Error(error));
    });
  }