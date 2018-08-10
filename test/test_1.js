/*
 *     Copyright 2015 Jens Schyma jeschyma@gmail.com
 *
 *    This File is a Part of the source of OpenFinTSJSClient.
 *
 *    This program is free software: you can redistribute it and/or  modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *    Please contact Jens Schyma if you are interested in a commercial license.
 *
 */
var express = require('express')
var http = require('http')
var textBody = require('body')
var FinTSServer = require('../dev/FinTSServer.js')
var FinTSClient = require('../')
var should = require('should')

describe('tests', function () {
  var bankenliste = {
    '12345678': {'blz': 12345678, 'url': 'http://TOBESET/cgiBin/hbciservlet'},
    'undefined': {'url': ''}
  }
  before(function (done) {
    // Start the Server
    var ipaddr = process.env.IP || '127.0.0.1'// process.env.IP;
    var port = process.env.PORT || 3000// process.env.PORT;
    var app = express()
    var myFINTSServer = new FinTSServer()
    myFINTSServer.myDebugLog = false
    app.configure(function () {
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
    })

    var server = http.createServer(app)
    console.log('Listening at IP ' + ipaddr + ' on port ' + port)
    server.listen(port, ipaddr, function () {
      var addr = server.address()
      console.log('FinTS server running at:', addr.address + ':' + addr.port + '/cgiBin/hbciservlet')
      bankenliste['12345678'].url = 'http://' + addr.address + ':' + addr.port + '/cgiBin/hbciservlet'
      myFINTSServer.myUrl = bankenliste['12345678'].url
      myFINTSServer.myHost = addr.address + ':' + addr.port
      done()
    })
  })

  it('Test 1  MsgInitDialog', function (done) {
    var client = new FinTSClient(12345678, 'test1', '1234', bankenliste)
    var oldUrl = client.destUrl
    client.MsgInitDialog(function (error, recvMsg, hasNeuUrl) {
      if (error) { throw error }
      client.bpd.should.have.property('versBpd', '78')
      client.upd.should.have.property('versUpd', '3')
      client.sysId.should.equal('DDDA10000000000000000000000A')
      client.konten.should.be.an.Array
      client.konten.should.have.a.lengthOf(2)
      client.konten[0].iban.should.equal('DE111234567800000001')
      should(client.konten[0].sepaData).equal(null)
      done()
    })
  })
  it('Test 2  MsgInitDialog wrong user', function (done) {
    var client = new FinTSClient(12345678, 'test2', '1234', bankenliste)
    var oldUrl = client.destUrl
    client.MsgInitDialog(function (error, recvMsg, hasNeuUrl) {
      if (error) {
        done()
      } else {
        throw 'Erfolg sollte nicht passieren'
      }
    })
  })
  it('Test 3  MsgInitDialog wrong pin', function (done) {
    var client = new FinTSClient(12345678, 'test1', '12341', bankenliste)
    var oldUrl = client.destUrl
    client.MsgInitDialog(function (error, recvMsg, hasNeuUrl) {
      if (error) {
        done()
      } else {
        throw 'Erfolg sollte nicht passieren'
      }
    })
  })
  it('Test 4  MsgEndDialog', function (done) {
    var client = new FinTSClient(12345678, 'test1', '1234', bankenliste)
    var oldUrl = client.destUrl
    client.MsgInitDialog(function (error, recvMsg, hasNeuUrl) {
      if (error) {
        throw error
      } else {
        client.MsgEndDialog(function (error, recvMsg2) {
          if (error) { throw error }
          done()
        })
      }
    })
  })
  it('Test 5  MsgRequestSepa', function (done) {
    var client = new FinTSClient(12345678, 'test1', '1234', bankenliste)
    client.MsgInitDialog(function (error, recvMsg, hasNeuUrl) {
      if (error) {
        throw error
      } else {
        client.bpd.should.have.property('versBpd', '78')
        client.upd.should.have.property('versUpd', '3')
        client.sysId.should.equal('DDDA10000000000000000000000A')
        client.konten.should.be.an.Array
        client.konten.should.have.a.lengthOf(2)
        client.konten[0].iban.should.equal('DE111234567800000001')
        should(client.konten[0].sepaData).equal(null)
        client.MsgRequestSepa(null, function (error3, recvMsg3, sepaList) {
          if (error3) { throw error3 }
          sepaList.should.be.an.Array
          sepaList[0].iban.should.equal('DE111234567800000001')
          sepaList[0].bic.should.equal('GENODE00TES')
          done()
        })
      }
    })
  })
  it('Test 6  EstablishConnection', function (done) {
    var client = new FinTSClient(12345678, 'test1', '1234', bankenliste)
    client.EstablishConnection(function (error) {
      if (error) {
        throw error
      } else {
        client.bpd.should.have.property('versBpd', '78')
        client.upd.should.have.property('versUpd', '3')
        client.sysId.should.equal('DDDA10000000000000000000000A')
        client.konten.should.be.an.Array
        client.konten.should.have.a.lengthOf(2)
        client.konten[0].iban.should.equal('DE111234567800000001')
        should(client.konten[0].sepaData).not.equal(null)
        client.konten[0].sepaData.iban.should.equal('DE111234567800000001')
        client.konten[0].sepaData.bic.should.equal('GENODE00TES')
        done()
      }
    })
  })
  it('Test 7  MsgGetKontoUmsaetze', function (done) {
    var client = new FinTSClient(12345678, 'test1', '1234', bankenliste)
    client.EstablishConnection(function (error) {
      if (error) {
        throw error
      } else {
        client.konten[0].sepaData.should.not.equal(null)
        client.MsgGetKontoUmsaetze(client.konten[0].sepaData, null, null, function (error2, rMsg, data) {
          if (error2) {
            throw error2
          } else {
            // Alles gut
            should(data).not.equal(null)
            data.should.be.an.Array
            should(data[0]).not.equal(null)
            // Testcase erweitern
            done()
          }
        })
      }
    })
  })
  it('Test 8  MsgSEPASingleTransfer  falsche TAN', function (done) {
    var client = new FinTSClient(12345678, 'test1', '1234', bankenliste)
    client.EstablishConnection(function (error) {
      if (error) {
        throw error
      } else {
        client.konten[0].sepaData.should.not.equal(null)
        client.MsgSEPASingleTransfer(client.konten[0].sepaData, {iban: 'DE60123456780000000003', bic: 'GENODE00TES'}, 'Max Muster', 'Verwzweck', 10.99, function (error2, rMsg, sendTanResponse) {
          if (error2) {
            throw error2
          } else {
            // Alles gut, wir müssen tan senden
            should(sendTanResponse).not.equal(null)
            sendTanResponse.should.be.an.Function
            sendTanResponse('FALSCH', function (error3, rMsg3) {
              should(error3).not.equal(null)
              done()
            })
          }
        })
      }
    })
  })
  it('Test 9  MsgSEPASingleTransfer  erfolgreich', function (done) {
    var client = new FinTSClient(12345678, 'test1', '1234', bankenliste)
    client.EstablishConnection(function (error) {
      if (error) {
        throw error
      } else {
        client.konten[0].sepaData.should.not.equal(null)
        client.MsgSEPASingleTransfer(client.konten[0].sepaData, {iban: 'DE60123456780000000003', bic: 'GENODE00TES'}, 'Max Muster', 'Verwzweck', 10.99, function (error2, rMsg, sendTanResponse) {
          if (error2) {
            throw error2
          } else {
            // Alles gut, wir müssen tan senden
            should(sendTanResponse).not.equal(null)
            sendTanResponse.should.be.an.Function
            sendTanResponse('1234', function (error3, rMsg3) {
              if (error3) {
                throw error3
              } else {
                done()
              }
            })
          }
        })
      }
    })
  })
})
