/*
 *  Copyright 20152016 Jens Schyma jeschyma@gmail.com
 *
 *  This File is a Part of the source of OpenFinTSJSClient.
 *
 *
 *
 *  This file is licensed to you under the Apache License, Version 2.0 (the
 *  "License"); you may not use this file except in compliance
 *  with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE2.0
 *  or in the LICENSE File contained in this project.
 *
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 *
 *
 *
 *  See the NOTICE file distributed with this work for additional information
 *  regarding copyright ownership.
 *
 *
 */
var express = require('express')
var cors = require('cors')
var http = require('http')
var textBody = require('body')
var FinTSServer = require('./FinTSServer.js')
var https = require('https')
var url = require('url')
var fs = require('fs')

var ipaddr = process.env.IP || '127.0.0.1' // process.env.IP;
var port = process.env.PORT || 3000 // process.env.PORT;
var app = express()
var myFINTSServer = new FinTSServer()
var myFINTSServer22 = new FinTSServer()
myFINTSServer22.protoVersion = 220

app.use(
  cors({
    origin: true,
    credentials: true
  })
)

app.get('/', function (req, res) {
  res.setHeader('ContentType', 'text/html')
  res.send('Test FinTS Server  at /cgiBin/hbciservlet und BLZ = 12345678')
})

app.post('/cgiBin/hbciservlet', function (req, res) {
  textBody(req, res, function (err, body) {
    // err probably means invalid HTTP protocol or some shiz.
    if (err) {
      res.statusCode = 500
      return res.end('NO U')
    }
    res.setHeader('ContentType', 'text/plain')
    res.send(myFINTSServer.handleIncomeMessage(body))
  })
})

app.post('/cgiBin/hbciservlet22', function (req, res) {
  textBody(req, res, function (err, body) {
    // err probably means invalid HTTP protocol or some shiz.
    if (err) {
      res.statusCode = 500
      return res.end('NO U')
    }
    res.setHeader('ContentType', 'text/plain')
    res.send(myFINTSServer.handleIncomeMessage(body))
  })
})

app.post('/cgiBin/hbciservletProxy', function (req2, res2) {
  textBody(req2, res2, function (err, body) {
    // err probably means invalid HTTP protocol or some shiz.
    if (err) {
      res2.statusCode = 500
      return res2.end('NO U')
    }
    // create a connection
    var postData = body
    var clearTxt2 = Buffer.from(body, 'base64').toString('utf8')
    console.log('Send: ' + clearTxt2)
    fs.appendFileSync('logProxyMsg.txt', 'Send: ' + clearTxt2 + '\n\r')
    var u = url.parse('TODO')
    var options = {
      hostname: u.hostname,
      port: u.port,
      path: u.path,
      method: 'POST',
      headers: {
        'ContentType': 'text/plain',
        'ContentLength': postData.length
      }
    }
    var data = ''
    var req = https.request(options, function (res) {
      res.on('data', function (chunk) {
        data += chunk
      })
      res.on('end', function () {
        var clearTxt = Buffer.from(data, 'base64').toString('utf8')
        console.log('Recv: ' + clearTxt)
        fs.appendFileSync('logProxyMsg.txt', 'Recv: ' + clearTxt + '\n\r')
        res2.setHeader('ContentType', 'text/plain')
        res2.send(data)
      })
    })

    req.on('error', function () {
      // Hier wird dann weiter gemacht :)
      res2.end()
    })
    req.write(postData)
    req.end()
  })
})

var server = http.createServer(app)
console.log('Listening at IP ' + ipaddr + ' on port ' + port)

server.listen(port, ipaddr, function () {
  var addr = server.address()
  console.log('FinTS server running at:', addr.address + ':' + addr.port + '/cgiBin/hbciservlet')
})
