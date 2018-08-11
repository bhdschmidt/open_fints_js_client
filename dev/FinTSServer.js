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
// Dieser FinTS 3.0 Server ist nur für Testzwecke und gibt daher auch nur Dummy Daten zurück
// der Funktionsumfang ist deutlich beschränkt und dient Primär des Tests des FinTSJSClients
'use strict'
var classes = require('../lib/Classes.js')
var NULL = classes.NULL
var Nachricht = classes.Nachricht
var Helper = classes.Helper
var DatenElementGruppe = classes.DatenElementGruppe
var fs = require('fs')

var port = process.env.PORT || 3000 // process.env.PORT;
module.exports = function () {
  var me = this
  me.nextDialogNr = 10000000
  me.myBlz = 12345678
  me.dialogArray = {}
  me.userDb = {
    'test1': {
      'u': 'test1',
      'pin': '1234'
    }
  }
  me.dbgLogNr = 1
  me.myUrl = 'http://localhost:' + port + '/cgiBin/hbciservlet'
  me.myHost = 'localhost:' + port
  me.myDebugLog = true
  me.protoVersion = 300
  me.hikas2Mode = false

  me.handleIncomeMessage = function (txt) {
    var s = new Buffer(txt, 'base64').toString('utf8')
    if (me.myDebugLog) {
      console.log('Incoming: \t' + s)
    }
    // Debug save incoming
    fs.appendFileSync('logSendMsg.txt', 'Neue Msg Nr: ' + me.dbgLogNr + '\n\r' + s + '\n\r\n\r')
    me.dbgLogNr++
    // End Debug
    var recvMsg = new Nachricht(me.protoVersion)
    try {
      recvMsg.parse(s)
      var sendtxt = null
      var sendMsg = null
      // 1. Schauen ob schon exitierender Dialog
      var dialogObj = me.getDialogFromMsg(recvMsg)
      if (dialogObj === null) {
        // Initialisierung
        var r = me.handleDialogInit(recvMsg)
        if (r.e) {
          sendMsg = r.msg
          sendtxt = 'ERROR'
        } else {
          dialogObj = r.diaObj
          sendMsg = r.msg
        }
      } else {
        // Normale nachricht
        sendMsg = me.createSendMsg(recvMsg, dialogObj)
        // Signatur prüfen
        if (!me.checkSignature(recvMsg, dialogObj)) {
          sendMsg.addSeg(Helper.newSegFromArray('HIRMG', 2, [
            [9800, NULL, 'Dialog abgebrochen!']
          ]))
          sendMsg.addSeg(Helper.newSegFromArrayWithBez('HIRMS', 2, recvMsg.selectSegByName('HNSHA')[0].nr, [
            [9340, NULL, 'Pin falsch']
          ]))
          sendtxt = 'ERROR'
        } else {
          // alles okay
        }
      }
      // 2. weiter bearbeiten
      if (sendtxt === null) {
        var ctrl = {
          'gmsg': {},
          'msgs': [],
          'content': []
        }
        for (let i = 1; i !== recvMsg.segments.length - 1; i++) {
          if (recvMsg.segments[i].name === 'HNHBK' ||
              recvMsg.segments[i].name === 'HNHBS' ||
              recvMsg.segments[i].name === 'HNSHA' ||
              recvMsg.segments[i].name === 'HNSHK') {
            // nichts tun
          } else if (recvMsg.segments[i].name === 'HKIDN') {
            if (!me.handleHKIDN(recvMsg.segments[i], ctrl, dialogObj, recvMsg)) {
              break
            }
          } else if (recvMsg.segments[i].name === 'HKVVB') {
            if (!me.handleHKVVB(recvMsg.segments[i], ctrl, dialogObj, recvMsg)) {
              break
            }
          } else if (recvMsg.segments[i].name === 'HKSYN') {
            if (!me.handleHKSYN(recvMsg.segments[i], ctrl, dialogObj, recvMsg)) {
              break
            }
          } else if (recvMsg.segments[i].name === 'HKEND') {
            if (!me.handleHKEND(recvMsg.segments[i], ctrl, dialogObj, recvMsg)) {
              break
            }
          } else if (recvMsg.segments[i].name === 'HKSPA') {
            if (!me.handleHKSPA(recvMsg.segments[i], ctrl, dialogObj, recvMsg)) {
              break
            }
          } else if (recvMsg.segments[i].name === 'HKKAZ') {
            if (!me.handleHKKAZ(recvMsg.segments[i], ctrl, dialogObj, recvMsg)) {
              break
            }
          } else if (recvMsg.segments[i].name === 'HKSAL') {
            if (!me.handleHKSAL(recvMsg.segments[i], ctrl, dialogObj, recvMsg)) {
              break
            }
          }
        }

        // Nachricht zusammenbauen
        var gmsgArray = []
        for (var k in ctrl.gmsg) {
          gmsgArray.push(ctrl.gmsg[k])
        }
        if (gmsgArray.length > 0) {
          sendMsg.addSeg(Helper.newSegFromArray('HIRMG', 2, gmsgArray))
          /* case 0:sendMsg.addSeg(Helper.newSegFromArray("HIRMG", 2, [["0010",NULL,"Entgegengenommen !"]]));break;
          case 1:sendMsg.addSeg(Helper.newSegFromArray("HIRMG", 2, [[3060,NULL,"Bitte beachten Sie die enthaltenen Warnungen/Hinweise"]]));break;
          case 2:sendMsg.addSeg(Helper.newSegFromArray("HIRMG", 2, [[9010,NULL,"Verarbeitung nicht moglich"]]));break;
          case 3:sendMsg.addSeg(Helper.newSegFromArray("HIRMG", 2, [[9800,NULL,"Dialog abgebrochen!"]]));break; */
        }
        for (let i = 0; i !== ctrl.msgs.length; i++) {
          sendMsg.addSeg(ctrl.msgs[i])
        }
        for (let i = 0; i !== ctrl.content.length; i++) {
          sendMsg.addSeg(ctrl.content[i])
        }
      }
      sendtxt = sendMsg.transformForSend()
      if (me.myDebugLog) {
        console.log('Send: \t' + sendtxt)
      }
      return new Buffer(sendtxt).toString('base64')
    } catch (e) {
      console.log('ErrorIn:\t' + e.toString() + 'stack:' + e.stack)
      return new Buffer('error').toString('base64')
    }
  }

  me.getDialogFromMsg = function (recvMsg) {
    var id = recvMsg.selectSegByName('HNHBK')[0].getEl(3)
    if (id === '0') {
      return null
    } else {
      var obj = me.dialogArray[id]
      if (obj === undefined) throw new Error('Diese Dialog ID existiert nicht!')
      return obj
    }
  }

  me.checkSignature = function (recvMsg, dialogObj) {
    if (recvMsg.isSigned()) {
      var HNSHK = recvMsg.selectSegByName('HNSHK')[0]
      var HNSHA = recvMsg.selectSegByName('HNSHA')[0]
      if ((HNSHK.vers === '4' && HNSHK.getEl(1).getEl(1) === 'PIN') || HNSHK.vers === '3') {

      } else {
        return false
      } // andere als PIN unterstützen wir nicht
      var pin = ''
      try {
        pin = HNSHA.getEl(3).getEl(1)
      } catch (e) {
        pin = HNSHA.getEl(3)
      }
      return me.userDb[dialogObj.user].pin === pin
    } else {
      return true
    }
  }

  me.createSendMsg = function (recvMsg, dialogObj) {
    var sendMsg = new Nachricht(me.protoVersion)
    if (recvMsg.isSigned()) {
      sendMsg.sign({
        'pin': '',
        'tan': null,
        'sysId': dialogObj.userSysId,
        'server': true,
        'pinVers': '999',
        'sigId': 0
      })
    }
    var nachrichtenNr = recvMsg.selectSegByName('HNHBK')[0].getEl(4)
    sendMsg.init(dialogObj.dialogNr, nachrichtenNr, me.myBlz, dialogObj.user)
    var bezugsDeg = new DatenElementGruppe()
    bezugsDeg.addDE(dialogObj.dialogNr)
    bezugsDeg.addDE(nachrichtenNr)
    sendMsg.selectSegByName('HNHBK')[0].store.addDEG(bezugsDeg)
    return sendMsg
  }

  me.handleDialogInit = function (recvMsg) {
    // HBCI 2.2 check
    if (me.protoVersion === 220 && recvMsg.selectSegByName('HNHBK')[0].getEl(2) === '300') {
      // error
      var sendMsg2 = new Nachricht(me.protoVersion)
      var nachrichtenNr = recvMsg.selectSegByName('HNHBK')[0].getEl(4)
      sendMsg2.init('2352638484028120', nachrichtenNr)
      var bezugsDeg = new DatenElementGruppe()
      bezugsDeg.addDE('2352638484028120')
      bezugsDeg.addDE(nachrichtenNr)
      sendMsg2.selectSegByName('HNHBK')[0].store.addDEG(bezugsDeg)
      sendMsg2.addSeg(Helper.newSegFromArray('HIRMG', 2, [
        ['9010', NULL, 'Nachricht ist komplett nicht bearbeitet (HBMSG=10319)'],
        ['9800', NULL, 'Dialog abgebrochen (HBMSG=10321)']
      ]))
      sendMsg2.addSeg(Helper.newSegFromArrayWithBez('HIRMS', 2, 1, [
        ['9120', '3', 'Nicht erwartet (HBMSG=10515)']
      ]))
      sendMsg2.addSeg(Helper.newSegFromArrayWithBez('HIRMS', 2, 2, [
        ['9110', NULL, 'Unbekannter Aufbau (HBMSG=10000)']
      ]))
      return {
        'e': true,
        'msg': sendMsg2
      }
    }
    // Dialog Initialisierung
    var dialogNr = 'DIA' + (me.nextDialogNr++)
    me.dialogArray[dialogNr] = {
      'dialogNr': dialogNr,
      'user': '',
      'userSysId': '0',
      'clientName': ''
    }
    var dialogObj = me.dialogArray[dialogNr]
    var HKIDN = recvMsg.selectSegByName('HKIDN')[0]
    dialogObj.user = HKIDN.getEl(2)
    dialogObj.userSysId = HKIDN.getEl(3)
    var HKVVB = recvMsg.selectSegByName('HKVVB')[0]
    // RC = 3050 BPD nicht mehr aktuell. Aktuelle Version folgt
    dialogObj.clientName = HKVVB.getEl(5)

    // 0. Send Msg erstellen
    var sendMsg = me.createSendMsg(recvMsg, dialogObj)
    // 1. System ID setzen
    if (dialogObj.userSysId === '0') {
      dialogObj.userSysId = 'USERSYSID'
    }
    var error = false
    var respToSeg = null
    // 2. prüfen ob User existiert
    if (me.userDb[dialogObj.user] === undefined) {
      // Error Code 9210 User unbekannt
      // Es gibt hier diverse auf diverse segmente HKVVB,HNSHK,HKIDN
      // 9931  "Sperrung des Kontos nach %1 Fehlversuchen"
      // 9010  "Verarbeitung nicht möglich"
      // 9210  "diverse"
      respToSeg = Helper.newSegFromArrayWithBez('HIRMS', 2, HKIDN.nr, [
        [9010, NULL, 'User unbekannt']
      ])
      error = true
    } else {
      // Signatur prüfen
      if (!me.checkSignature(recvMsg, dialogObj)) {
        respToSeg = Helper.newSegFromArrayWithBez('HIRMS', 2, recvMsg.selectSegByName('HNSHA')[0].nr, [
          [9340, NULL, 'Pin falsch']
        ])
        error = true
      }
    }
    if (error) {
      // Fehler hier Fehler nachrichten zurück schicken
      sendMsg.addSeg(Helper.newSegFromArray('HIRMG', 2, [
        [9800, NULL, 'Dialog abgebrochen!']
      ]))
      sendMsg.addSeg(respToSeg)
      return {
        'e': true,
        'msg': sendMsg
      }
    } else {
      // Bisher kein Fehler aufgetreten
      return {
        'e': false,
        'msg': sendMsg,
        'diaObj': dialogObj
      }
    }
  }
  me.handleHKIDN = function (segment, ctrl, dialogObj) {
    var bez = segment.nr
    return true
  }
  me.handleHKVVB = function (segment, ctrl, dialogObj) {
    var bpdVers = segment.getEl(1)
    var updVers = segment.getEl(2)
    var bez = segment.nr
    ctrl.gmsg['3060'] = ['3060', '', 'Bitte beachten Sie die enthaltenen Warnungen/Hinweise']
    var msgArray = []
    if (bpdVers !== '78') {
      if (me.protoVersion === 300) {
        ctrl.content.push(Helper.newSegFromArrayWithBez('HIBPA', 3, bez, ['78', ['280', me.myBlz], 'FinTSJSClient Test Bank', '1', '1', '300', '500']))
        ctrl.content.push(Helper.newSegFromArrayWithBez('HIKOM', 4, bez, [
          ['280', me.myBlz], '1', ['3', Helper.convertJSTextTo(me.myUrl)],
          ['2', Helper.convertJSTextTo(me.myHost)]
        ]))
        ctrl.content.push(Helper.newSegFromArrayWithBez('HISHV', 3, bez, ['J', ['RDH', '3'],
          ['PIN', '1'],
          ['RDH', '9'],
          ['RDH', '10'],
          ['RDH', '7']
        ]))
      } else {
        ctrl.content.push(Helper.newSegFromArrayWithBez('HIBPA', 2, bez, ['78', ['280', me.myBlz], 'FinTSJSClient Test Bank', '3', '1', [201, 210, 220], '0']))
        ctrl.content.push(Helper.newSegFromArrayWithBez('HIKOM', 3, bez, [
          ['280', me.myBlz], '1', ['2', Helper.convertJSTextTo(me.myUrl), NULL, 'MIM', 1]
        ]))
        ctrl.content.push(Helper.newSegFromArrayWithBez('HISHV', 2, bez, ['N', ['DDV', '1']]))
      }
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIEKAS', 5, bez, ['1', '1', '1', ['J', 'J', 'N', '3']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIKAZS', 4, bez, ['1', '1', ['365', 'J']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIKAZS', 5, bez, ['1', '1', ['365', 'J', 'N']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIKAZS', 6, bez, ['1', '1', '1', ['365', 'J', 'N']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIKAZS', 7, bez, ['1', '1', '1', ['365', 'J', 'N']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIPPDS', 1, bez, ['1', '1', '1', ['1', 'Telekom', 'prepaid', 'N', '', '', '15;30;50', '2', 'Vodafone', 'prepaid', 'N', '', '', '15;25;50', '3', 'EPlus', 'prepaid', 'N', '', '', '15;20;30', '4', 'O2', 'prepaid', 'N', '', '', '15;20;30', '5', 'Congstar', 'prepaid', 'N', '', '', '15;30;50', '6', 'Blau', 'prepaid', 'N', '', '', '15;20;30']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIPAES', 1, bez, ['1', '1', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIPROS', 3, bez, ['1', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIPSPS', 1, bez, ['1', '1', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIQTGS', 1, bez, ['1', '1', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HISALS', 5, bez, ['3', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HISALS', 7, bez, ['1', '1', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HISLAS', 4, bez, ['1', '1', ['500', '14', '04', '05']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICSBS', 1, bez, ['1', '1', '1', ['N', 'N']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICSLS', 1, bez, ['1', '1', '1', 'J']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICSES', 1, bez, ['1', '1', '1', ['1', '400']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HISUBS', 4, bez, ['1', '1', ['500', '14', '51', '53', '54', '56', '67', '68', '69']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HITUAS', 2, bez, ['1', '1', ['1', '400', '14', '51', '53', '54', '56', '67', '68', '69']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HITUBS', 1, bez, ['1', '1', 'J']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HITUES', 2, bez, ['1', '1', ['1', '400', '14', '51', '53', '54', '56', '67', '68', '69']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HITULS', 1, bez, ['1', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICCSS', 1, bez, ['1', '1', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HISPAS', 1, bez, ['1', '1', '1', ['J', 'J', 'N', 'sepade?:xsd?:pain.001.001.02.xsd', 'sepade?:xsd?:pain.001.002.02.xsd', 'sepade?:xsd?:pain.001.002.03.xsd', 'sepade?:xsd?:pain.001.003.03.xsd', 'sepade?:xsd?:pain.008.002.02.xsd', 'sepade?:xsd?:pain.008.003.02.xsd']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICCMS', 1, bez, ['1', '1', '1', ['500', 'N', 'N']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIDSES', 1, bez, ['1', '1', '1', ['3', '45', '6', '45']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIBSES', 1, bez, ['1', '1', '1', ['2', '45', '2', '45']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIDMES', 1, bez, ['1', '1', '1', ['3', '45', '6', '45', '500', 'N', 'N']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIBMES', 1, bez, ['1', '1', '1', ['2', '45', '2', '45', '500', 'N', 'N']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIUEBS', 3, bez, ['1', '1', ['14', '51', '53', '54', '56', '67', '68', '69']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIUMBS', 1, bez, ['1', '1', ['14', '51']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICDBS', 1, bez, ['1', '1', '1', 'N']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICDLS', 1, bez, ['1', '1', '1', ['0', '0', 'N', 'J']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIPPDS', 2, bez, ['1', '1', '1', ['1', 'Telekom', 'prepaid', 'N', '', '', '15;30;50', '2', 'Vodafone', 'prepaid', 'N', '', '', '15;25;50', '3', 'EPlus', 'prepaid', 'N', '', '', '15;20;30', '4', 'O2', 'prepaid', 'N', '', '', '15;20;30', '5', 'Congstar', 'prepaid', 'N', '', '', '15;30;50', '6', 'Blau', 'prepaid', 'N', '', '', '15;20;30']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICDNS', 1, bez, ['1', '1', '1', ['0', '1', '3650', 'J', 'J', 'J', 'J', 'N', 'J', 'J', 'J', 'J', '0000', '0000']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIDSBS', 1, bez, ['1', '1', '1', ['N', 'N', '9999']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICUBS', 1, bez, ['1', '1', '1', 'N']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICUMS', 1, bez, ['1', '1', '1', 'OTHR']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HICDES', 1, bez, ['1', '1', '1', ['4', '1', '3650', '000', '0000']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIDSWS', 1, bez, ['1', '1', '1', 'J']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIDMCS', 1, bez, ['1', '1', '1', ['500', 'N', 'N', '2', '45', '2', '45', '', 'sepade?:xsd?:pain.008.003.02.xsd']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIDSCS', 1, bez, ['1', '1', '1', ['2', '45', '2', '45', '', 'sepade?:xsd?:pain.008.003.02.xsd']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIECAS', 1, bez, ['1', '1', '1', ['J', 'N', 'N', 'urn?:iso?:std?:iso?:20022?:tech?:xsd?:camt.053.001.02']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('GIVPUS', 1, bez, ['1', '1', '1', 'N']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('GIVPDS', 1, bez, ['1', '1', '1', '1']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HITANS', 5, bez, ['1', '1', '1', ['J', 'N', '0', '942', '2', 'MTAN2', 'mobileTAN', '', 'mobile TAN', '6', '1', 'SMS', '2048', '1', 'J', '1', '0', 'N', '0', '2', 'N', 'J', '00', '1', '1', '962', '2', 'HHD1.4', 'HHD', '1.4', 'SmartTAN plus manuell', '6', '1', 'Challenge', '2048', '1', 'J', '1', '0', 'N', '0', '2', 'N', 'J', '00', '1', '1', '972', '2', 'HHD1.4OPT', 'HHDOPT1', '1.4', 'SmartTAN plus optisch', '6', '1', 'Challenge', '2048', '1', 'J', '1', '0', 'N', '0', '2', 'N', 'J', '00', '1', '1']]))
      if (me.protoVersion === 300) ctrl.content.push(Helper.newSegFromArrayWithBez('HIPINS', 1, bez, ['1', '1', '1', ['5', '20', '6', 'Benutzer ID', '', 'HKSPA', 'N', 'HKKAZ', 'N', 'HKKAZ', 'N', 'HKSAL', 'N', 'HKSLA', 'J', 'HKSUB', 'J', 'HKTUA', 'J', 'HKTUB', 'N', 'HKTUE', 'J', 'HKTUL', 'J', 'HKUEB', 'J', 'HKUMB', 'J', 'HKPRO', 'N', 'HKEKA', 'N', 'HKKAZ', 'N', 'HKKAZ', 'N', 'HKPPD', 'J', 'HKPAE', 'J', 'HKPSP', 'N', 'HKQTG', 'N', 'HKSAL', 'N', 'HKCSB', 'N', 'HKCSL', 'J', 'HKCSE', 'J', 'HKCCS', 'J', 'HKCCM', 'J', 'HKDSE', 'J', 'HKBSE', 'J', 'HKDME', 'J', 'HKBME', 'J', 'HKCDB', 'N', 'HKCDL', 'J', 'HKPPD', 'J', 'HKCDN', 'J', 'HKDSB', 'N', 'HKCUB', 'N', 'HKCUM', 'J', 'HKCDE', 'J', 'HKDSW', 'J', 'HKDMC', 'J', 'HKDSC', 'J', 'HKECA', 'N', 'GKVPU', 'N', 'GKVPD', 'N', 'HKTAN', 'N', 'HKTAN', 'N']]))
      else ctrl.content.push(Helper.newSegFromArrayWithBez('DIPINS', 1, bez, ['1', '1', ['HKSPA', 'N', 'HKKAZ', 'N', 'HKKAZ', 'N', 'HKSAL', 'N', 'HKSLA', 'J', 'HKSUB', 'J', 'HKTUA', 'J', 'HKTUB', 'N', 'HKTUE', 'J', 'HKTUL', 'J', 'HKUEB', 'J', 'HKUMB', 'J', 'HKPRO', 'N', 'HKEKA', 'N', 'HKKAZ', 'N', 'HKKAZ', 'N', 'HKPPD', 'J', 'HKPAE', 'J', 'HKPSP', 'N', 'HKQTG', 'N', 'HKSAL', 'N', 'HKCSB', 'N', 'HKCSL', 'J', 'HKCSE', 'J', 'HKCCS', 'J', 'HKCCM', 'J', 'HKDSE', 'J', 'HKBSE', 'J', 'HKDME', 'J', 'HKBME', 'J', 'HKCDB', 'N', 'HKCDL', 'J', 'HKPPD', 'J', 'HKCDN', 'J', 'HKDSB', 'N', 'HKCUB', 'N', 'HKCUM', 'J', 'HKCDE', 'J', 'HKDSW', 'J', 'HKDMC', 'J', 'HKDSC', 'J', 'HKECA', 'N', 'GKVPU', 'N', 'GKVPD', 'N', 'HKTAN', 'N', 'HKTAN', 'N']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIAZSS', 1, bez, ['1', '1', '1', ['1', 'N', '', '', '', '', '', '', '', '', '', '', 'HKTUA;2;0;1;811', 'HKDSC;1;0;1;811', 'HKPPD;2;0;1;811', 'HKDSE;1;0;1;811', 'HKSLA;4;0;1;811', 'HKTUE;2;0;1;811', 'HKSUB;4;0;1;811', 'HKCDL;1;0;1;811', 'HKCDB;1;0;1;811', 'HKKAZ;6;0;1;811', 'HKCSE;1;0;1;811', 'HKSAL;4;0;1;811', 'HKQTG;1;0;1;811', 'GKVPU;1;0;1;811', 'HKUMB;1;0;1;811', 'HKECA;1;0;1;811', 'HKDMC;1;0;1;811', 'HKDME;1;0;1;811', 'HKSAL;7;0;1;811', 'HKSPA;1;0;1;811', 'HKEKA;5;0;1;811', 'HKKAZ;4;0;1;811', 'HKPSP;1;0;1;811', 'HKKAZ;5;0;1;811', 'HKCSL;1;0;1;811', 'HKCDN;1;0;1;811', 'HKTUL;1;0;1;811', 'HKPPD;1;0;1;811', 'HKPAE;1;0;1;811', 'HKCCM;1;0;1;811', 'HKIDN;2;0;1;811', 'HKDSW;1;0;1;811', 'HKCUM;1;0;1;811', 'HKPRO;3;0;1;811', 'GKVPD;1;0;1;811', 'HKCDE;1;0;1;811', 'HKBSE;1;0;1;811', 'HKCSB;1;0;1;811', 'HKCCS;1;0;1;811', 'HKDSB;1;0;1;811', 'HKBME;1;0;1;811', 'HKCUB;1;0;1;811', 'HKUEB;3;0;1;811', 'HKTUB;1;0;1;811', 'HKKAZ;7;0;1;811']]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIVISS', 1, bez, ['1', '1', '1', ['1;;;;']]))

      msgArray.push(['3050', '', 'BPD nicht mehr aktuell, aktuelle Version enthalten.'])
    }
    if (updVers !== '3') {
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIUPA', 4, bez, [dialogObj.user, '2', '3']))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIUPD', 6, bez, [
        ['1', '', '280', me.myBlz], 'DE111234567800000001', dialogObj.user, '', 'EUR', 'Fullname', '', 'Girokonto', '', ['HKSAK', '1'],
        ['HKISA', '1'],
        ['HKSSP', '1'],
        ['HKSAL', '1'],
        ['HKKAZ', '1'],
        ['HKEKA', '1'],
        ['HKCDB', '1'],
        ['HKPSP', '1'],
        ['HKCSL', '1'],
        ['HKCDL', '1'],
        ['HKPAE', '1'],
        ['HKPPD', '1'],
        ['HKCDN', '1'],
        ['HKCSB', '1'],
        ['HKCUB', '1'],
        ['HKQTG', '1'],
        ['HKSPA', '1'],
        ['HKDSB', '1'],
        ['HKCCM', '1'],
        ['HKCUM', '1'],
        ['HKCCS', '1'],
        ['HKCDE', '1'],
        ['HKCSE', '1'],
        ['HKDSW', '1'],
        ['HKPRO', '1'],
        ['HKSAL', '1'],
        ['HKKAZ', '1'],
        ['HKTUL', '1'],
        ['HKTUB', '1'],
        ['HKPRO', '1'],
        ['GKVPU', '1'],
        ['GKVPD', '1']
      ]))
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIUPD', 6, bez, [
        ['2', '', '280', me.myBlz], 'DE111234567800000002', dialogObj.user, '', 'EUR', 'Fullname', '', 'Tagesgeld', '', ['HKSAK', '1'],
        ['HKISA', '1'],
        ['HKSSP', '1'],
        ['HKSAL', '1'],
        ['HKKAZ', '1'],
        ['HKEKA', '1'],
        ['HKPSP', '1'],
        ['HKCSL', '1'],
        ['HKPAE', '1'],
        ['HKCSB', '1'],
        ['HKCUB', '1'],
        ['HKQTG', '1'],
        ['HKSPA', '1'],
        ['HKCUM', '1'],
        ['HKCCS', '1'],
        ['HKCSE', '1'],
        ['HKPRO', '1'],
        ['HKSAL', '1'],
        ['HKKAZ', '1'],
        ['HKTUL', '1'],
        ['HKTUB', '1'],
        ['HKPRO', '1'],
        ['GKVPU', '1'],
        ['GKVPD', '1']
      ]))
      msgArray.push(['3050', '', 'UPD nicht mehr aktuell, aktuelle Version enthalten.'])
      msgArray.push(['3920', '', 'Zugelassene TANVerfahren fur den Benutzer', '942'])
    }
    msgArray.push(['0901', '', '*PIN gultig.'])
    msgArray.push(['0020', '', '*Dialoginitialisierung erfolgreich'])
    ctrl.msgs.push(Helper.newSegFromArrayWithBez('HIRMS', 2, bez, msgArray))
    return true
  }

  me.handleHKSYN = function (segment, ctrl, dialogObj) {
    var bez = segment.nr
    ctrl.msgs.push(Helper.newSegFromArrayWithBez('HIRMS', 2, bez, [
      ['0020', '', 'Auftrag ausgefuhrt.']
    ]))
    ctrl.content.push(Helper.newSegFromArrayWithBez('HISYN', segment.vers === '2' ? 3 : 4, bez, ['DDDA10000000000000000000000A']))
    return true
  }

  me.handleHKEND = function (segment, ctrl, dialogObj) {
    var bez = segment.nr
    ctrl.gmsg['0010'] = ['0010', '', 'Nachricht entgegengenommen.']
    ctrl.gmsg['0100'] = ['0100', '', 'Dialog beendet.']
    return true
  }

  me.handleHKSPA = function (segment, ctrl, dialogObj) {
    var bez = segment.nr
    ctrl.gmsg['0010'] = ['0010', '', 'Nachricht entgegengenommen.']
    ctrl.msgs.push(Helper.newSegFromArrayWithBez('HIRMS', 2, bez, [
      ['0020', '', 'Auftrag ausgefuehrt']
    ]))
    ctrl.content.push(Helper.newSegFromArrayWithBez('HISPA', 1, bez, [
      ['J', 'DE111234567800000001', 'GENODE00TES', '1', '', '280', '12345678'],
      ['J', 'DE111234567800000002', 'GENODE00TES', '2', '', '280', '12345678']
    ]))
    return true
  }

  me.handleHKKAZ = function (segment, ctrl, dialogObj) {
    var atOnceMode = function () {
      var bez = segment.nr
      ctrl.gmsg['0010'] = ['0010', '', 'Nachricht entgegengenommen.']
      ctrl.msgs.push(Helper.newSegFromArrayWithBez('HIRMS', 2, bez, [
        ['0020', '', '*Umsatzbereitstellung erfolgreich']
      ]))
      var mt490 = ''
      mt490 += '\r\n\r\n'
      mt490 += ':20:STARTUMS\r\n'
      mt490 += ':25:12345678/0000000001\r\n'
      mt490 += ':28C:0\r\n'
      mt490 += ':60F:C150101EUR1041,23\r\n'
      mt490 += ':61:150101C182,34NMSCNONREF\r\n'
      mt490 += ':86:051?00UEBERWEISG?10931?20Ihre Kontonummer 0000001234\r\n'
      mt490 += '?21/Test Ueberweisung 1?22n WS EREF: 1100011011 IBAN:\r\n'
      mt490 += '?23 DE1100000100000001234 BIC?24: GENODE11 ?1011010100\r\n'
      mt490 += '?31?32Bank\r\n'
      mt490 += ':62F:C150101EUR1223,57\r\n'
      mt490 += '\r\n'
      mt490 += ':20:STARTUMS\r\n'
      mt490 += ':25:12345678/0000000001\r\n'
      mt490 += ':28C:0\r\n'
      mt490 += ':60F:C150301EUR1223,57\r\n'
      mt490 += ':61:150301C100,03NMSCNONREF\r\n'
      mt490 += ':86:051?00UEBERWEISG?10931?20Ihre Kontonummer 0000001234\r\n'
      mt490 += '?21/Test Ueberweisung 2?22n WS EREF: 1100011011 IBAN:\r\n'
      mt490 += '?23 DE1100000100000001234 BIC?24: GENODE11 ?1011010100\r\n'
      mt490 += '?31?32Bank\r\n'
      mt490 += ':61:150301C100,00NMSCNONREF\r\n'
      mt490 += ':86:051?00UEBERWEISG?10931?20Ihre Kontonummer 0000001234\r\n'
      mt490 += '?21/Test Ueberweisung 3?22n WS EREF: 1100011011 IBAN:\r\n'
      mt490 += '?23 DE1100000100000001234 BIC?24: GENODE11 ?1011010100\r\n'
      mt490 += '?31?32Bank\r\n'
      mt490 += ':62F:C150101EUR1423,60\r\n'
      mt490 += '\r\n'
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIKAZ', 7, bez, [Helper.Byte(mt490)]))
    }

    var first = function () {
      var bez = segment.nr
      ctrl.gmsg['0010'] = ['0010', '', 'Nachricht entgegengenommen.']
      ctrl.msgs.push(Helper.newSegFromArrayWithBez('HIRMS', 2, bez, [
        ['3040', '', 'Auftrag nur teilweise ausgefuhrt', 'myContId']
      ]))
      var mt490 = ''
      mt490 += '\r\n\r\n'
      mt490 += ':20:STARTUMS\r\n'
      mt490 += ':25:12345678/0000000001\r\n'
      mt490 += ':28C:0\r\n'
      mt490 += ':60F:C150101EUR1041,23\r\n'
      mt490 += ':61:150101C182,34NMSCNONREF\r\n'
      mt490 += ':86:051?00UEBERWEISG?10931?20Ihre Kontonummer 0000001234\r\n'
      mt490 += '?21/Test Ueberweisung 1?22n WS EREF: 1100011011 IBAN:\r\n'
      mt490 += '?23 DE1100000100000001234 BIC?24: GENODE11 ?1011010100\r\n'
      mt490 += '?31?32Bank\r\n'
      mt490 += ':62F:C150101EUR1223,57\r\n'
      mt490 += '\r\n'
      mt490 += ':20:STARTUMS\r\n'
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIKAZ', 7, bez, [Helper.Byte(mt490)]))
    }

    var second = function () {
      var bez = segment.nr
      ctrl.gmsg['0010'] = ['0010', '', 'Nachricht entgegengenommen.']
      ctrl.msgs.push(Helper.newSegFromArrayWithBez('HIRMS', 2, bez, [
        ['0020', '', '*Umsatzbereitstellung erfolgreich']
      ]))
      var mt490 = ''
      mt490 += ':25:12345678/0000000001\r\n'
      mt490 += ':28C:0\r\n'
      mt490 += ':60F:C150301EUR1223,57\r\n'
      mt490 += ':61:150301C100,03NMSCNONREF\r\n'
      mt490 += ':86:051?00UEBERWEISG?10931?20Ihre Kontonummer 0000001234\r\n'
      mt490 += '?21/Test Ueberweisung 2?22n WS EREF: 1100011011 IBAN:\r\n'
      mt490 += '?23 DE1100000100000001234 BIC?24: GENODE11 ?1011010100\r\n'
      mt490 += '?31?32Bank\r\n'
      mt490 += ':61:150301C100,00NMSCNONREF\r\n'
      mt490 += ':86:051?00UEBERWEISG?10931?20Ihre Kontonummer 0000001234\r\n'
      mt490 += '?21/Test Ueberweisung 3?22n WS EREF: 1100011011 IBAN:\r\n'
      mt490 += '?23 DE1100000100000001234 BIC?24: GENODE11 ?1011010100\r\n'
      mt490 += '?31?32Bank\r\n'
      mt490 += ':62F:C150101EUR1423,60\r\n'
      mt490 += '\r\n'
      ctrl.content.push(Helper.newSegFromArrayWithBez('HIKAZ', 7, bez, [Helper.Byte(mt490)]))
    }

    var hikas2Mode = me.hikas2Mode
    if (!hikas2Mode) {
      atOnceMode()
    } else {
      // to be deleted: var e = false
      if (segment.store.data.length >= 6) {
        if (segment.getEl(6) === 'myContId') {
          second()
        } else {
          var bez = segment.nr
          ctrl.gmsg['9050'] = ['9050', '', 'Teilweise fehlerhaft ']
          ctrl.msgs.push(Helper.newSegFromArrayWithBez('HIRMS', 2, bez, [
            ['9210', '', 'Aufsetzpunkt unbekannt.']
          ]))
        }
      } else {
        first()
      }
    }
    return true
  }

  me.handleHKSAL = function (segment, ctrl, dialogObj) {
    var bez = segment.nr
    ctrl.gmsg['0010'] = ['0010', '', 'Nachricht entgegengenommen.']
    ctrl.msgs.push(Helper.newSegFromArrayWithBez('HIRMS', 2, bez, [
      ['0020', '', 'Auftrag ausgefuehrt']
    ]))
    if (segment.vers === '5') {
      ctrl.content.push(Helper.newSegFromArrayWithBez('HISAL', 5, bez, [
        [1, NULL, 280, 12346789], 'Normalsparen', 'EUR', ['C', '4,36', 'EUR', '20150219']
      ]))
    } else if (segment.vers === '6') {
      ctrl.content.push(Helper.newSegFromArrayWithBez('HISAL', 6, bez, [
        [1, NULL, 280, 12346789], 'Normalsparen', 'EUR', ['C', '4,36', 'EUR', '20150219']
      ]))
    } else if (segment.vers === '7') {
      ctrl.content.push(Helper.newSegFromArrayWithBez('HISAL', 7, bez, [
        ['DE92232323', 'GENOT', NULL, 280, 12346789], 'Normalsparen', 'EUR', ['C', '4,36', 'EUR', '20150219']
      ]))
    }
    return true
  }
}
