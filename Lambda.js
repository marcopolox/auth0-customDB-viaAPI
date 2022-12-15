const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const TABLE_NAME = [INSERT YOUR OWN TABLE NAME FROM DYNAMODB];
const bcrypt = require("bcryptjs");

exports.handler = async (event, context) => {
  
  const DynamoDBClient = new DynamoDB({ region: "INSERT THE REGION WHERE YOUR DYNAMODB IS LOCATED" });
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json"
  };

  console.log("Table name: ",TABLE_NAME);
  
  try {
    switch (event.routeKey) {
      case "POST /users/login":
        let userJSON = JSON.parse(event.body);
        //console.log("userJSON: ",userJSON);
        let pwdmatch = false;
        if(userJSON.password === null) { throw new Error("No password provided"); }
        var params = {
          ExpressionAttributeValues: {
            ':e': {"S" : userJSON.email}
          },
          KeyConditionExpression: "email = :e",
          TableName: TABLE_NAME
        };
        const dynamoUser = await DynamoDBClient.query(params);
        if(dynamoUser && dynamoUser.Count == 1){
          //console.log("Found user, count = 1...comparing passwords");
          //console.log("dynamoUser: ",dynamoUser);
          //console.log("pwd: "+JSON.stringify(userJSON.password)+" | hashed pwd: "+JSON.stringify(dynamoUser.Items[0].password.S));
          pwdmatch = await bcrypt.compareSync(userJSON.password, dynamoUser.Items[0].password.S);
          //console.log("pwdmatch: ",pwdmatch);
          if(dynamoUser.Items[0].Name) {body = {"profile": {"name": dynamoUser.Items[0].Name.S}};}
          else {body = {};};
        }
        if(!pwdmatch) {throw new Error(`Login failed for "${userJSON.email}"`);}        
        break; 
      case "DELETE /users":
        try {
            let deleteJSON = JSON.parse(event.body);
            //console.log("deleting user: ",deleteJSON);
            await DynamoDBClient
            .deleteItem({
                TableName: TABLE_NAME,
                Key: {email: {"S": deleteJSON.email}}
            });
            body = {};
        } catch (error) {
            throw new Error(error);
        }
        break;
      case "GET /users/{email}":
        //console.log("Email: ",event.pathParameters.email);
        var params = {
          ExpressionAttributeValues: {
            ':e': {"S" : event.pathParameters.email}
          },
          KeyConditionExpression: "email = :e",
          TableName: TABLE_NAME
        };
        let user = await DynamoDBClient.query(params);
        //console.log("user found: ",user);
        if(!user) {throw new Error(`Error getting user: "${event.pathParameters.email}"`);}
        if(user.Items.length == 0){
            body = {}
        } else {
            if(user.Items[0].Name){
                body = {"profile": { "name": user.Items[0].Name.S}};
            } else {
                body={};
            }  
        }     
        //console.log("returning body: ",body);
        break;
      /*case "GET /users":
        console.log("Getting all users");
        body = await DynamoDBClient.scan({ TableName: TABLE_NAME });
        break;*/
      case "PUT /users":
        let requestJSON = JSON.parse(event.body);
        try {
            var params = {
            ExpressionAttributeValues: {
                ':e': {"S" : requestJSON.email}
            },
            KeyConditionExpression: "email = :e",
            TableName: TABLE_NAME
            };
            let userexists = await DynamoDBClient.query(params);
            //console.log("user found: ",userexists);
            if(!userexists.Items.length) {
                //console.log("creating user");
                await DynamoDBClient
                .putItem({
                    TableName: TABLE_NAME,
                    Item: {
                        'email': {"S" : requestJSON.email},
                        'password': {"S" : requestJSON.password}
                    }
                });
                body = {};
            } else {
                throw new Error(`User already exists: "${requestJSON.email}"`);
            }
        } catch (error) {
            throw new Error(error);
        }
        break;
        case "POST /users":
            let updatepwdJSON = JSON.parse(event.body);
            //console.log("updating user: ",updatepwdJSON);
            var params = {
                ExpressionAttributeValues: {
                    ':e': {"S" : updatepwdJSON.email}
                },
                KeyConditionExpression: "email = :e",
                TableName: TABLE_NAME
                };
                let userfound = await DynamoDBClient.query(params);
                //console.log("user found: ",userfound);
                if(userfound.Items.length) {
                    //console.log("Updating user password user");
                    await DynamoDBClient
                        .updateItem({
                            TableName: TABLE_NAME,
                            ExpressionAttributeValues: {
                                ':p': {"S" : updatepwdJSON.password}
                            },
                            Key: {email: {"S": updatepwdJSON.email}},
                            UpdateExpression: "SET password = :p"
                        });
                    body = `User password updated: ${updatepwdJSON.email}`;
                } else {
                    throw new Error(`User not found: "${requestJSON.email}"`);
                }
            break;
      default:
        throw new Error(`Unsupported route: "${event.routeKey}"`);
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers
  };
};