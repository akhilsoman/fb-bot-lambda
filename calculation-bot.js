'use strict';
var VERIFY_TOKEN = "alohomora@@";
var https = require('https');
var PAGE_ACCESS_TOKEN = "EAAFwkOBynwoBAAahhJZCDnSeD25QNV8XxjvQt6ZCSahmNWn6PC62VeCEtFAKwMC9xhSWB9eqB0ddTTVXc0beSysuH7bqIxDW2zaeXiJDN1x3OgDF1w8Dz3Fqvucb5ZAN4baZA3b2l5jPmQHI3YAVdiLi90KJn4HAiEMtfjIukAZDZD";
const pi = 3.14159265358979;
const fixed = 2;
const loadPinError = `For Loadpin enter data as below format:
lp, Load in tonne, Depth of shear groove in mm, Diameter of pin in mm, Downhole dia in mm`;
const ccError = `For Compression Cells enter data as below format:
cc, Load in tonne, Depth of shear groove in mm, Diameter of pin in mm, Downhole dia in mm`;
const wcError = `For Weight Calculation enter data as below format:
wc, Diameter in mm, Length in mm`;
exports.handler = (event, context, callback) => {
    
  // process GET request
  if(event.queryStringParameters){
    var queryParams = event.queryStringParameters;
 
    var rVerifyToken = queryParams['hub.verify_token']
 
    if (rVerifyToken === VERIFY_TOKEN) {
      var challenge = queryParams['hub.challenge']
      
      var response = {
        'body': parseInt(challenge),
        'statusCode': 200
      };
      
      callback(null, response);
    }else{
      var response = {
        'body': 'Error, wrong validation token',
        'statusCode': 422
      };
      
      callback(null, response);
    }
  
  // process POST request
  }else{
    var data = JSON.parse(event.body);
     
    // Make sure this is a page subscription
    if (data.object === 'page') {
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
        var pageID = entry.id;
        var timeOfEvent = entry.time;
        // Iterate over each messaging event
        entry.messaging.forEach(function(msg) {
          if (msg.message) {
            receivedMessage(msg);
          } else {
            console.log("Webhook received unknown event: ", event);
          }
        });
    });
    
    }
    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    var response = {
      'body': "ok",
      'statusCode': 200
    };
      
    callback(null, response);
  }
}
function receivedMessage(event) {
  console.log("Message data: ", event.message);
  
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  console.log("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));
  var messageId = message.mid;
  var messageText = message.text;
  var messageAttachments = message.attachments;
  if (messageText) {
    processMessage(messageText.trim(), senderID);
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}
function processMessage(messageText, senderID){
  let messageArray = messageText.split(",");
  let response;
  const calcType = messageArray[0].toUpperCase();
  
  switch (calcType) {
    case 'LP':
      response = getLPCalc(messageArray,calcType);
      break;
    case 'CC':
       response = getCCCalc(messageArray,calcType);
        break;
    case 'WC':
       response = getWCCalc(messageArray,calcType);
        break;
    default:
      response = `Invalid Input, Please enter correct format.
1) ${loadPinError}`;
  }
  
  sendTextMessage(senderID, response);
}
function getLPCalc(params,calcType){
  try {
    let lpCapacity = parseFloat(params[1])*1000;
    let depthOfGroove = parseFloat(params[2]);
    let diameter = parseFloat(params[3]);
    let downholeSize = parseFloat(params[4]);
    let stressArea = calcStressArea(depthOfGroove,diameter,downholeSize);
    let stress = lpCapacity/(2*stressArea);
    let output = calcOutput(stress);
    let safetyFactor = calcSafetyFactor(stress);
    
    return `Output : ${output} mV/V,                      Safety Factor : ${safetyFactor}`
  }
  catch(e){
    return `Oops ! Something went wrong. ${loadPinError}`;
  }  
}
function getCCCalc(params,calcType){
  try {
    let maxStress = 130
    let lpCapacity = parseFloat(params[1])*1000;
    let depthOfGroove = parseFloat(params[2]);
    let diameter = parseFloat(params[3]);
    let downholeSize = parseFloat(params[4]);
    let stressArea = calcStressArea(depthOfGroove,diameter,downholeSize);
    let stress = lpCapacity/(stressArea);
    let output = calcOutput(stress,calcType);
    let fos = (maxStress/stress).toFixed(fixed);
    
    return `Output : ${output} mV/V,                      FOS : ${fos}`;
  }
  catch(e){
    return `Oops ! Something went wrong. ${ccError}`;
  }  
}
function getWCCalc(params,calcType){
  try {
    let diameter = parseFloat(params[1]);
    let length = parseFloat(params[2]);
    let weight = calcWeight(diameter,length);
    
    return `Weight : ${weight} Kg`;
  }
  catch(e){
    return `Oops ! Something went wrong. ${wcError}`;
  }  
}
function calcWeight(diameter,length){
  return (((diameter/1000)*(diameter/1000)*pi/4)*(length/1000)*7854).toFixed(4);
}
function calcOutput(stress, calcType) {
  return  (calcType === "LP") ? (((stress/7500)*1000000*20)/10000).toFixed(fixed) :  (((stress/20000)*1000000*20*2.6)/40000).toFixed(fixed);
}
function calcSafetyFactor(stress){
  return (54/stress).toFixed(fixed);
}
function calcStressArea(depthOfGroove,diameter,downholeSize){
  return ((pi/4)*(((diameter-(2*depthOfGroove))*(diameter-(2*depthOfGroove)))-(downholeSize*downholeSize))).toFixed(fixed);
}
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  callSendAPI(messageData);
}
function callSendAPI(messageData) {
  var body = JSON.stringify(messageData);
  var path = '/v2.6/me/messages?access_token=' + PAGE_ACCESS_TOKEN;
  var options = {
    host: "graph.facebook.com",
    path: path,
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
  };
  var callback = function(response) {
    var str = ''
    response.on('data', function (chunk) {
      str += chunk;
    });
    response.on('end', function () {
 
    });
  }
  var req = https.request(options, callback);
  req.on('error', function(e) {
    console.log('problem with request: '+ e);
  });
 
  req.write(body);
  req.end();
}