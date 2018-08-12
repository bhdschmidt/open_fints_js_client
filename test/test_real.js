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

/* global describe it after before */
/* eslint-disable no-unused-expressions */
'use strict'
// var express = require('express')
// var http = require('http')
// var textBody = require('body')
var FinTSClient = require('../')
var should = require('should')

var previousTestsOk = true
var checkPreviousTests = function () {
  if (!previousTestsOk) throw new Error('Vorangegangene Tests sind fehlgeschlagen, aus Sicherheitsgründen, dass der Account nicht gesperrt wird hier abbrechen.')
  previousTestsOk = false
}

var mochaCatcher = function (done, cb) {
  return function () {
    var origArguments = arguments
    try {
      cb.apply(null, origArguments)
    } catch (mochaError) {
      done(mochaError)
    }
  }
}

var bunyan = require('bunyan')
var live = require('bunyan-live-logger')
var gLog = null

var logger = function (n) {
  if (gLog) {
    return gLog.child({
      testcase: n
    })
  } else {
    return null
  }
}

describe('testReal', function () {
  this.timeout(20 * 60 * 1000)
  // never used: var myFINTSServer = null
  var credentials = null

  before(function (done) {
    credentials = require('./credentials.js')
    /*
    module.exports = {
      bankenliste:{
        '12345678':{'blz':12345678,'url':"http://localhost:3000/cgi-bin/hbciservlet"},
        "undefined":{'url':""}
      },
      blz:12345678,
      user:"",
      pin:"",
      bunyanLiveLogger:true
    };
    */

    credentials.should.have.property('bankenliste')
    credentials.should.have.property('user')
    credentials.should.have.property('pin')
    credentials.should.have.property('blz')
    should(credentials.user).not.equal('')
    should(credentials.pin).not.equal('')
    if (credentials && credentials.bunyanLiveLogger) {
      gLog = bunyan.createLogger({
        name: 'testcases  testsReal',
        src: true,
        streams: [{
          level: 'trace',
          stream: live({
            readyCb: function () {
              done()
            }
          }),
          type: 'raw'
        }]
      })
    } else {
      done()
    }
  })

  it('Test 1  MsgInitDialog', function (done) {
    checkPreviousTests()
    var client = new FinTSClient(credentials.blz, credentials.user, credentials.pin, credentials.bankenliste, logger('Test 1'))
    var oldUrl = client.destUrl
    client.MsgInitDialog(mochaCatcher(done, function (error, recvMsg, hasNeuUrl) {
      if (error) {
        var pv = ''
        try {
          pv = recvMsg.selectSegByName('HNHBK')[0].getEl(2)
          console.log(pv)
        } catch (xe) {
          console.log(xe)
        }
        if (pv === '220') {
          previousTestsOk = true
          return done(new Error('This is just because of HBCI 2.2 Error:' + error.toString()))
        } else {
          throw error
        }
      }
      client.bpd.should.have.property('versBpd')
      client.upd.should.have.property('versUpd')
      client.sysId.should.not.equal('')
      client.konten.should.be.an.Array
      client.MsgCheckAndEndDialog(recvMsg, mochaCatcher(done, function (error, recvMsg2) {
        if (error) {
          throw error
        }
        previousTestsOk = true
        return done()
      }))
    }))
  })

  it('Test 2  MsgInitDialog wrong user', function (done) {
    checkPreviousTests()
    var client = new FinTSClient(credentials.blz, 'wrong', '12345', credentials.bankenliste, logger('Test 2'))
    var oldUrl = client.destUrl
    client.MsgInitDialog(mochaCatcher(done, function (error, recvMsg, hasNeuUrl) {
      client.MsgCheckAndEndDialog(recvMsg, function (error, recvMsg2) {})
      if (error) {
        previousTestsOk = true
        return done()
      } else {
        throw 'Erfolg sollte nicht passieren'
      }
    }))
  })

  describe('wrongPinTest', function () {
    var testPerformed = false
    after(function (done) {
      if (testPerformed) {
        // login with good pin to reset bad counter
        var client = new FinTSClient(credentials.blz, credentials.user, credentials.pin, credentials.bankenliste, logger('wrongPinTest after'))
        var oldUrl = client.destUrl
        client.MsgInitDialog(mochaCatcher(done, function (error, recvMsg, hasNeuUrl) {
          if (error) {
            console.log(error)
          }
          client.MsgCheckAndEndDialog(recvMsg, mochaCatcher(done, function (error, recvMsg2) {
            if (error) {
              console.log(error)
            }
            done()
          }))
        }))
      } else {
        done()
      }
    })

    it('Test 3  MsgInitDialog wrong pin', function (done) {
      checkPreviousTests()
      testPerformed = true
      var client = new FinTSClient(credentials.blz, credentials.user, '12345', credentials.bankenliste, logger('Test 3'))
      var oldUrl = client.destUrl
      client.MsgInitDialog(mochaCatcher(done, function (error, recvMsg, hasNeuUrl) {
        client.MsgCheckAndEndDialog(recvMsg, function (error2, recvMsg2) {})
        should(error).not.be.null
        previousTestsOk = true
        done()
      }))
    })
  })

  it('Test 6  EstablishConnection', function (done) {
    checkPreviousTests()
    var client = new FinTSClient(credentials.blz, credentials.user, credentials.pin, credentials.bankenliste, logger('Test 6'))
    client.EstablishConnection(mochaCatcher(done, function (error) {
      if (error) {
        throw error
      } else {
        client.MsgEndDialog(function (error, recvMsg2) {})
        client.bpd.should.have.property('versBpd')
        client.upd.should.have.property('versUpd')
        client.konten.should.be.an.Array
        previousTestsOk = true
        done()
      }
    }))
  })

  it('Test 7  MsgGetKontoUmsaetze', function (done) {
    checkPreviousTests()
    var client = new FinTSClient(credentials.blz, credentials.user, credentials.pin, credentials.bankenliste, logger('Test 7'))
    client.EstablishConnection(mochaCatcher(done, function (error) {
      if (error) {
        throw error
      } else {
        client.konten[0].sepaData.should.not.equal(null)
        client.MsgGetKontoUmsaetze(client.konten[0].sepaData, null, null, mochaCatcher(done, function (error2, rMsg, data) {
          if (error2) {
            if (error2 instanceof client.Exceptions.GVNotSupportedByKI &&
              error2.gvType === 'HIKAZ') {
              previousTestsOk = true
            }
            throw error2
          } else {
            // Alles gut
            should(data).not.equal(null)
            data.should.be.an.Array
            // Testcase erweitern
            client.MsgCheckAndEndDialog(rMsg, function (error, recvMsg2) {})
            previousTestsOk = true
            done()
          }
        }))
      }
    }))
  })

  it('Test 8  MsgGetSaldo', function (done) {
    checkPreviousTests()
    var client = new FinTSClient(credentials.blz, credentials.user, credentials.pin, credentials.bankenliste, logger('Test 8'))
    client.EstablishConnection(mochaCatcher(done, function (error) {
      if (error) {
        throw error
      } else {
        client.konten[0].sepaData.should.not.equal(null)
        client.MsgGetSaldo(client.konten[0].sepaData, mochaCatcher(done, function (error2, rMsg, data) {
          if (rMsg) client.MsgCheckAndEndDialog(rMsg, function (error, recvMsg2) {})
          if (error2) {
            throw error2
          } else {
            // Testcase erweitern
            previousTestsOk = true
            done()
          }
        }))
      }
    }))
  })
})
