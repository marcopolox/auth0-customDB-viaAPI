async function login(email, password, callback) {
  // This script should authenticate a user against the credentials stored in
  // your database.
  // It is executed when a user attempts to log in or immediately after signing
  // up (as a verification that the user was successfully signed up).
  //
  // Everything returned by this script will be set as part of the user profile
  // and will be visible by any of the tenant admins. Avoid adding attributes
  // with values such as passwords, keys, secrets, etc.
  //
  // The `password` parameter of this function is in plain text. It must be
  // hashed/salted to match whatever is stored in your database. For example:
  //
  //     var bcrypt = require('bcrypt@0.8.5');
  //     bcrypt.compare(password, dbPasswordHash, function(err, res)) { ... }
  //
  // There are three ways this script can finish:
  // 1. The user's credentials are valid. The returned user profile should be in
  // the following format: https://auth0.com/docs/users/normalized/auth0/normalized-user-profile-schema
  //     var profile = {
  //       user_id: ..., // user_id is mandatory
  //       email: ...,
  //       [...]
  //     };
  //     callback(null, profile);
  // 2. The user's credentials are invalid
  //     callback(new WrongUsernameOrPasswordError(email, "my error message"));
  //
  //    Note: Passing no arguments or a falsey first argument to
  //    `WrongUsernameOrPasswordError` will result in the error being logged as
  //    an `fu` event (invalid username/email) with an empty string for a user_id.
  //    Providing a truthy first argument will result in the error being logged
  //    as an `fp` event (the user exists, but the password is invalid) with a
  //    user_id value of "auth0|<first argument>". See the `Log Event Type Codes`
  //    documentation for more information about these event types:
  //    https://auth0.com/docs/deploy-monitor/logs/log-event-type-codes
  // 3. Something went wrong while trying to reach your database
  //     callback(new Error("my error message"));
  //
  // A list of Node.js modules which can be referenced is available here:
  //
  //    https://tehsis.github.io/webtaskio-canirequire/

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
	    
      //console.log("getting token for self app");
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
  const apiLoginOptions = {
        url: configuration.API_ENDPOINT+'/login',
        method: "POST",
        json: true,
        data: {
            email: email,
            password: password
        },
        headers: {
            "Authorization": "Bearer " + token
        }
    };
  axios(apiLoginOptions)
  .then(function (response) {
    console.log(response);
    let profile = {
        user_id: email,
        email: email
    };
    return callback(null, profile);
  })
  .catch(function (error) {
    console.log(error);
    return callback(new WrongUsernameOrPasswordError(email, error));
  }); 
}