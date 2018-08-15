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
'use strict'
var https = require('https')
var http = require('http')
var url = require('url')
var bankenliste = require('./bankenliste.js')
var classes = require('./Classes.js')
var Konto = classes.Konto
var NULL = classes.NULL
var Nachricht = classes.Nachricht
var Helper = classes.Helper
var beautifyBPD = classes.beautifyBPD
var Order = classes.Order
var Exceptions = classes.Exceptions
var MTParser = require('./MTParser.js')
var bunyan = require('bunyan')
var encoding = require('encoding')

/*
  FinTSClient(inBlz,inKundenId,inPin,inBankenlist,inLogger)
    inBlz       Die entsprechende BLZ als Zahl oder String
    inKundenId   Die Benutzerkennung bzw. KundenID  9999999999 = Anonymer Benutzer
    inPin       Die Pin
    inBankenlist   Liste mit Bankdaten mit Key BLZ
              {
                  '12345678':{'blz':12345678,'url':"https://localhost:3000/cgi-bin/hbciservlet"},
                  "undefined":{'url':""}
              };
    inLogger     Ein Bunyan Logger per default wird nichts gelogged

  Attribute
    = Notwendig um die Verbindung herzustellen =
    blz
    ctry       Zurzeit immer 280 für Deutschland
    kundenId
    pin
    tan         Noch NULL, da keine Geschäftsvorfälle mit Tan zurzeit unterstützt
    debugMode     Debug Modus (Logging) sollte nicht genutzt werden, kann über ein bunyan logger auch realisiert werden

    = Status des aktuellen Client Objekts =
    dialogId     Ein FinTSClient Objekt repräsentiert ein Dialog / dies ist die vom KI zugewiesene ID
    nextMsgNr     Nachrichten werden Nummeriert beginnend von 1 dies ist die nächste Nummer
    clientName     Name des Clients, sollte an die entsprechende benutztende Software angepasst werden
    clientVersion   Version des Clients

    = Bank Paramter Daten und SystemID + letzte benutzte SignaturID
    sysId       vom KI zugewiesene SystemID, identifiziert diese Anwendung für den entsprechenden Benutzer eindeutig.
              Sollte um unnötige Anlage neuer IDs zu Vermeiden für weitere Verbindungen beibehalten werden (für immer).
    lastSignaturId  Zuletzt verwendete SignaturID hängt an der SystemID und gewährleistet, dass Nachrichten nicht mehrfach eingereicht werden.
    bpd         Die Bank Paramter Daten siehe Dokumentation zu mehr Details
    {
      'versBpd':"0",                  // Version der BPD
      'bankName':"",                  // Name der Bank
      'supportedVers':["300"],            // Unterstützte HBCI/FinTS Versionen
      'url':"",                    // URL für Pin/Tan, wird durch die Bankenliste und die BLZ vorbelegt
      'pin':{
        'minLength':0,                // Minimal Länge der Pin
        'maxLength':100,              // Maximal Länge der Pin
        'maxTanLength':100,            // Maximale Länger der Tan
        'txtBenutzerkennung':'Benutzerkennung',  // Vorbelegungs Text für das Feld Benutzerkennung
        'txtKundenId':'Kunden ID',        // Vorbelegungs Text für das Feld KundenID
        'availibleSeg':{              // Verfügbare Geschäftsvorfälle als Key und Wert für Tanerforderlichkeit
          'HXXXX':true,                // Wert true > mit Tan
          'HXXXX':false                // Wert false > ohne Tan
        }
      },
      'tan':{
        'oneStepAvailible':true,          // EinSchrittVerfahren verfügbar
        'multipleTan':false,            // Mehrfachtan
        'hashType':"0",              // zu verwendender Hash Algorhytmus
        'tanVerfahren':{'999':{          // Verfügbare Tan Verfahren
          'code':'999',                // Code des Verfahrens
          'oneTwoStepVers':"1",          // 1Ein SchrittVerfahren / 2Zwei SchrittVerfahren
          'techId':'PIN',              // Technische ID des Verfahrens
          'desc':'Einfaches PinVerfahren',      // Lesbare Beschreibung des Verfahrens
          'maxLenTan':100,              // Maximal Länge der Tan
          'tanAlphanum':true,            // Tan Alphanumerisch?
          'txtRueckwert':'Rückgabewert',        // Vorbelegungs Text Rückgabewert
          'maxLenRueckwert':100,          // Maximale Länge des Rückgabewerts
          'anzTanlist':'2',              // Anzahl TanListen
          'multiTan':true,              // Mehrfachtan?
          'tanZeitDiabez':"",            // Tan Zeit Dialog Bezug
          'tanListNrReq':"",            // Tan Listennummer erforderlich?
          'auftragsstorno':false,            // Auftragsstorno?
          'challangeClassReq':false,        // Challange Klasse erforderlich?
          'challangeValueReq':false          // Challange Wert erforderlich?
        }}
      },
      'clone':function()                // Funktion um die Daten zu Clonen
      'gvParameters':{
        "HHHH":{
          1:SEGMENT,
          2:SEGMENT
        }
      }
    };

    = User Paramter Daten =
    upd         Die User Paramter Daten
    {
    'versUpd':"0",                    // Version der User Paramter Daten
    'geschaeftsVorgGesp':true,            // Wie sind die nicht aufgeführten Geschäftsvorfälle zu Werten? true =  sind gesperrt / false = Keine Aussage darüber treffbar
    'availibleTanVerfahren':["999"],          // Verfügbare Tan Verfahren für den Benutzer, [0] ist die aktuell verwendete
    'clone':function()                  // Funktion um die Daten zu Clonen
    };
    konten        Liste der Konten des Benutzers
    [{
    'iban':"",           // IBAN des Kontos
    'kontoNr':         // KontoNr
    'unterKonto':         // Unterkonto Merkmal
    'ctryCode':         // Länderkennzeichen idr. 280 für Deutschland
    'blz':             // BLZ
    'kundenId':         // Kunden ID dem das Konto gehört
    'kontoar':           // Art des Kontos
    'currency':         // Währung des Kontos
    'kunde1Name':         // Name des Kunden
    'productName':       // Produktbezeichnung
     'sepaData':{        // Zusätzliche Daten für SEPA Konten, kann null sein, wenn kein SEPA Konto z.B. Depots etc.
      'isSepa': true,      // Ist SEPA Konto?
        'iban':"",          // IBAN
        'bic':"",          // BIC
        'kontoNr':"",        // KontoNR
        'unterKonto':"",      // Unter Konto
        'ctryCode':"280",      // Ctry Code
        'blz':""          // BLZ
    }
    }]

  Methoden
    < Internal >
    clear()                  Initialisiert alle Attribute
    getNewSigId()              Erzeugt eine neue Signatur ID
      returns sigId (int)
    SendMsgToDestination(msg,callback)    Verschickt Nachricht per HTTPS an die Bank
      msg    (Nachricht)
      callback (function(error,msg))  =  Wird gerufen wenn Nachricht erfolgreich (error==null) verschickt + Antwort(msg instance of Nachricht) empfangen
    debugLogMsg(txt,send)         Zum Loggen von Nachrichten

    < Public >
    MsgInitDialog(callback)         Initialisiert einen Dialog
      callback (function(error,recvMsg,hasNeuUrl))   error  === null Kein Fehler
                               recvMsg (Nachricht)
                               hasNeuUrl  === true wenn eine andere URL zurückgemeldet wurde
    MsgEndDialog(callback)         Beendet einen Dialog
      callback (function(error,recvMsg))         error  === null kein Fehler
                               recvMsg (Nachricht)
    EstablishConnection(callback)     Vereinfachte Variante um eine Verbindung mit der Bank aufzubauen
      callback (function(error))             error  === null kein Fehler
                                   !== null Fehler / ein MsgEndDialog ist nichtmehr erforderlich
    MsgRequestSepa(forKontoNr,callback)  Lade SEPA Zusatz Daten (vor allem die BIC)
      forKontoNr                   KontoNr für das betreffende Konto, kann aber auch weg gelassen werden, dann für alle Konten
      callback (function(error,recvMsg,sepaList))  Error  === null kein Fehler
                              RecvMsg (Nachricht)
                              SepaList [] array von Sepa Daten Format siehe UPD Konten[].sepaData
    MsgGetKontoUmsaetze(konto,fromDate,toDate,callback)  Lädt die Kontenumsätze für ein bestimmtes Konto
      konto                       Das Konto für das die Umsätze geladen werden sollen
      fromDate (Date)                 vom Datum (können leer==null gelassen werden dann wird alles verfügbare geladen)
      toDate    (Date)                 zum Datum
      callback  (function(error,recvMsg,umsaetze))   error  === null kein Fehler
                               recvMsg (Nachricht)
                               umsaetze [] Enthält die Umsatz Daten mit folgendem Format
                              [{      // pro Tag ein Objekt siehe MT940 SWIFT Format
                                'refnr':"STARTUMS",    // ReferenzNummer
                                'bezRefnr':null,    // BezugsreferenzNummer
                                'kontoBez':"12345678/0000000001",  // Kontobezeichnung BLZ/Kontonr
                                'auszugNr':"",      // Auszugsnummer
                                'anfangssaldo':{
                                  'isZwischensaldo':false,
                                  'sollHaben'   : 'H',
                                  'buchungsdatum' : Date,
                                  'currency':'EUR',
                                  'value':150.22 },
                                'schlusssaldo':{
                                  'isZwischensaldo':false,
                                  'sollHaben'   : 'H',
                                  'buchungsdatum' : Date,
                                  'currency':'EUR',
                                  'value':150.22 },
                                'saetze':[        // Die eigentlichen Buchungssätze
                                  {
                                    'datum':Date,
                                    'isStorno':false,
                                    'sollHaben':'S',
                                    'value':150.22,
                                    'isVerwendungszweckObject':true,// Verwendungszweck ist Objekt?
                                    'verwendungszweck': "TEXT" // oder
                                      {
                                        'buchungstext':"",
                                        'primanotenNr':"",
                                        'text':"",
                                        'bicKontrahent':"",
                                        'ibanKontrahent':"",
                                        'nameKontrahent':"",
                                        'textKeyAddion':""
                                      }
                                  }
                                ]
                              }]

    MsgGetSaldo(konto,cb)      Lädt den Saldo eines bestimmten Kontos
      konto                       Das Konto für das der Saldo geladen werden sollen
      callback  (function(error,recvMsg,saldo))     error  === null kein Fehler
                                Saldo
                                {"desc":"Normalsparen",
                                 "cur":"EUR",
                                 "saldo":{  "sollHaben":"H",    // SALDO OBJECT
                                      "buchungsdatum":Date,
                                      "currency":"EUR",
                                      "value":5},
                                 "saldoVorgemerkt":null,      // SALDO OBJECT
                                 "creditLine":{   "currency":"EUR",
                                          "value":5},    // BETRAG OBJECT
                                 "availAmount":null,        // BETRAG OBJECT
                                 "usedAmount":null,        // BETRAG OBJECT
                                 "overdraft":null,          // BETRAG OBJECT
                                 "bookingDate":Date,
                                 "faelligkeitDate":Date}
    closeSecure ()        Stellt sicher, dass keine Sensiblen Informationen wie die PIN noch im RAM sind, sollte am Ende immer gerufen werden

*/
var FinTSClient = function (inBlz, inKundenId, inPin, inBankenlist, logger) {
  var me = this
  me.Exceptions = Exceptions
  // Logger
  me.log = {
    'main': (logger || bunyan.createLogger({
      name: 'openFinTsJsClient',
      streams: []
    }))
  }
  me.log.con = me.log.main.child({
    area: 'connection'
  })
  me.log.conest = me.log.main.child({
    area: 'connectionEstablish'
  })
  me.log.gv = me.log.main.child({
    area: 'gv'
  })
  // Other
  me.blz = inBlz
  me.ctry = 280
  me.kundenId = Helper.escapeUserString(inKundenId)
  me.pin = Helper.escapeUserString(inPin)
  me.tan = NULL
  me.debugMode = false

  // Use given blz and forth parameter as url if it's a string
  if (typeof inBankenlist === 'string') {
    var bankUrl = inBankenlist
    inBankenlist = {}
    inBankenlist[inBlz] = {
      'blz': inBlz,
      'url': bankUrl
    }
  }

  // Technical
  me.dialogId = 0
  me.nextMsgNr = 1
  me.clientName = 'OpenFinTSJSClient'
  me.clientVersion = 4
  me.protoVersion = 300 // 300=FinTS;220=HBCI 2.2
  me.inConnection = false

  // BPD und SystemId mit Letzt benutzter Signatur ID
  me.sysId = 0
  me.lastSignaturId = 1
  me.bpd = {}
  me.bpd.url = ''

  // UPD  Data
  me.upd = {}
  me.konten = []

  me.clear = function () {
    me.dialogId = 0
    me.nextMsgNr = 1
    me.sysId = 0
    me.lastSignaturId = 1
    me.bpd = {
      'versBpd': '0',
      'bankName': '',
      'supportedVers': ['300'],
      'url': '',
      'pin': {
        'minLength': 0,
        'maxLength': 100,
        'maxTanLength': 100,
        'txtBenutzerkennung': 'Benutzerkennung',
        'txtKundenId': 'Kunden ID',
        'availibleSeg': {}
      },
      'tan': {
        'oneStepAvailible': true,
        'multipleTan': false,
        'hashType': '0',
        'tanVerfahren': {
          '999': {
            'code': '999',
            'oneTwoStepVers': '1',
            'techId': 'PIN',
            'desc': 'Einfaches PinVerfahren',
            'maxLenTan': 100,
            'tanAlphanum': true,
            'txtRueckwert': 'Rückgabewert',
            'maxLenRueckwert': 100,
            'anzTanlist': '2',
            'multiTan': true,
            'tanZeitDiabez': '',
            'tanListNrReq': '',
            'auftragsstorno': false,
            'challangeClassReq': false,
            'challangeValueReq': false
          }
        }
      },
      'clone': function () {
        return JSON.parse(JSON.stringify(this))
      },
      'gvParameters': {}
    }

    try {
      me.bpd.url = inBankenlist === undefined ? bankenliste['' + inBlz].url : inBankenlist['' + inBlz].url
    } catch (e) {
      throw new Exceptions.MissingBankConnectionDataException(inBlz)
    }

    me.upd = {
      'versUpd': '0',
      'geschaeftsVorgGesp': true,
      'availibleTanVerfahren': ['999'],
      'clone': function () {
        return JSON.parse(JSON.stringify(this))
      }
    }
    me.konten = []
  }
  me.clear()

  me.closeSecure = function () {
    me.bpd = null
    me.upd = null
    me.konten = null
    me.pin = null
    me.tan = null
    me.sysId = null
  }

  me.getNewSigId = function () {
    var next = (new Date()).getTime()
    if (next > me.lastSignaturId) {
      me.lastSignaturId = next
      return me.lastSignaturId
    } else {
      me.lastSignaturId++
      return me.lastSignaturId
    }
  }

  me.MsgInitDialog = function (cb) {
    var msg = new Nachricht(me.protoVersion)
    if (me.kundenId !== 9999999999) {
      msg.sign({
        'pin': me.pin,
        'tan': NULL,
        'sysId': me.sysId,
        'pinVers': me.upd.availibleTanVerfahren[0],
        'sigId': me.getNewSigId()
      })
    }
    msg.init(me.dialogId, me.nextMsgNr, me.blz, me.kundenId)
    me.nextMsgNr++
    //  KundensystemID  = 0; Kundensystemssatus = 0
    msg.addSeg(Helper.newSegFromArray('HKIDN', 2, [
      [me.ctry, me.blz], me.kundenId, me.sysId, 1
    ]))
    // BPD Vers = 0; UPD Vers = 0; Dialogspr. = 0
    var HKVVB = Helper.newSegFromArray('HKVVB', 3, [me.bpd.versBpd, me.upd.versUpd, 0, me.clientName, me.clientVersion])
    msg.addSeg(HKVVB)
    if (me.kundenId !== 9999999999 && me.sysId === 0) var syn = msg.addSeg(Helper.newSegFromArray('HKSYN', me.protoVersion === 220 ? 2 : 3, [0])) // Synchronisierung starten
    me.log.gv.debug({
      gv: 'HKVVB'
    }, 'Send HKVVB,HKIDN')
    me.SendMsgToDestination(msg, function (error, recvMsg) {
      if (error) {
        me.log.gv.error(error, {
          gv: 'HKVVB'
        }, 'Could not send HKVVB,HKIDN')
        try {
          cb(error, recvMsg, false)
        } catch (cbError) {
          me.log.gv.error(cbError, {
            gv: 'HKVVB'
          }, 'Unhandled callback Error in HKVVB,HKIDN')
        }
      } else {
        // Prüfen ob Erfolgreich
        var HIRMG = null
        try {
          HIRMG = recvMsg.selectSegByName('HIRMG')[0]
        } catch (e) {};
        if (HIRMG !== null && (HIRMG.getEl(1).getEl(1) === '0010' || HIRMG.getEl(1).getEl(1) === '3060')) {
          if (Helper.checkMsgsWithBelongToForId(recvMsg, HKVVB.nr, '0020')) {
            try {
              // 1. Dialog ID zuweisen
              me.dialogId = recvMsg.selectSegByName('HNHBK')[0].getEl(3)
              // 2. System Id
              if (me.kundenId !== 9999999999 && me.sysId === 0) {
                me.sysId = recvMsg.selectSegByNameAndBelongTo('HISYN', syn)[0].getEl(1)
              }
              // 3. Möglicherweise neue kommunikationsdaten
              var HIKOM = recvMsg.selectSegByName('HIKOM')
              HIKOM = HIKOM.length > 0 ? HIKOM[0] : null
              var neuUrl = me.bpd.url
              if (HIKOM) {
                for (let i = 2; i < HIKOM.store.data.length; i++) {
                  // There can be up to 9 Kommunikationsparameter
                  //  however we check only if the first one which is HTTP (3)
                  //  is different to the one we used before, according to the spec we should try reconnecting all 9
                  if (HIKOM.store.data[i].getEl(1) === '3') {
                    neuUrl = (Helper.convertFromToJSText(HIKOM.store.data[i].getEl(2)))
                    if (neuUrl.indexOf('http') !== 0) {
                      neuUrl = 'https://' + neuUrl
                    }
                    break
                  }
                }
              }
              var hasNeuUrl = false
              if (neuUrl !== me.bpd.url) {
                hasNeuUrl = true
              }
              // 4. Mögliche KontoInformationen
              if (me.konten.length === 0) {
                var kontoList = recvMsg.selectSegByName('HIUPD')
                for (let i = 0; i !== kontoList.length; i++) {
                  var konto = new Konto()
                  konto.iban = kontoList[i].getEl(2)
                  konto.kontoNr = kontoList[i].getEl(1).getEl(1)
                  konto.unterKonto = kontoList[i].getEl(1).getEl(2)
                  konto.ctryCode = kontoList[i].getEl(1).getEl(3)
                  konto.blz = kontoList[i].getEl(1).getEl(4)
                  konto.kundenId = kontoList[i].getEl(3)
                  konto.kontoar = kontoList[i].getEl(4)
                  konto.currency = kontoList[i].getEl(5)
                  konto.kunde1Name = kontoList[i].getEl(6)
                  konto.productName = kontoList[i].getEl(8)
                  konto.sepaData = null
                  me.konten.push(konto)
                }
              }
              // 5. Analysiere BPD
              try {
                // 5.1 Vers
                var HIBPA = recvMsg.selectSegByName('HIBPA')[0]
                me.bpd.versBpd = HIBPA.getEl(1)
                // 5.2 sonst
                me.bpd.bankName = HIBPA.getEl(3)
                me.bpd.supportedVers = Helper.convertIntoArray(HIBPA.getEl(6))
                me.bpd.url = neuUrl
              } catch (ee) {
                me.log.gv.error(ee, {
                  gv: 'HIBPA'
                }, 'Error while analyse BPD')
              }
              if (me.protoVersion === 300) {
                try {
                  // 5.3 Pins
                  var pinData = recvMsg.selectSegByName('HIPINS')[0].getEl(4)
                  me.bpd.pin.minLength = pinData.getEl(1)
                  me.bpd.pin.maxLength = pinData.getEl(2)
                  me.bpd.pin.maxTanLength = pinData.getEl(3)
                  me.bpd.pin.txtBenutzerkennung = pinData.getEl(4)
                  me.bpd.pin.txtKundenId = pinData.getEl(5)
                  // 5.3.2 Tanerforderlichkeit für die Geschäftsvorfälle
                  me.bpd.pin.availibleSeg = {} // true and false für ob Tan erforderlich
                  for (let i = 5; i < pinData.data.length; i++) {
                    me.bpd.pin.availibleSeg[pinData.data[i]] = pinData.data[i + 1].toUpperCase() === 'J'
                    i++
                  }
                } catch (ee) {
                  me.log.gv.error(ee, {
                    gv: 'HIPINS'
                  }, 'Error while analyse HIPINS')
                }
              } else {
                var pinDataSpk = recvMsg.selectSegByName('DIPINS')
                if (pinDataSpk.length > 0) {
                  try {
                    // 5.3 Pins
                    pinDataSpk = pinDataSpk[0]
                    /* me.bpd.pin.minLength     = ;
                    me.bpd.pin.maxLength       = ;
                    me.bpd.pin.maxTanLength     = ;
                    me.bpd.pin.txtBenutzerkennung  = ;
                    me.bpd.pin.txtKundenId     = ; */
                    // 5.3.2 Tanerforderlichkeit für die Geschäftsvorfälle
                    me.bpd.pin.availibleSeg = {} // true and false für ob Tan erforderlich
                    var pinTanSpkData = pinDataSpk.getEl(3).data
                    for (let i = 0; i < pinTanSpkData.length; i++) {
                      me.bpd.pin.availibleSeg[pinTanSpkData[i]] = pinTanSpkData[i + 1].toUpperCase() === 'J'
                      i++
                    }
                  } catch (ee) {
                    me.log.gv.error(ee, {
                      gv: 'DIPINS'
                    }, 'Error while analyse HIPINS')
                  }
                } else {
                  me.log.gv.warning({
                    gv: 'HIPINS'
                  }, 'Becuase it is 2.2 no HIPINS and no DIPINS.')
                }
              }
              try {
                // 5.4 Tan
                var HITANS = recvMsg.selectSegByName('HITANS')[0]
                if (HITANS.vers === 5) {
                  var tanData = HITANS.getEl(4)
                  me.bpd.tan.oneStepAvailible = tanData.getEl(1).toUpperCase() === 'J'
                  me.bpd.tan.multipleTan = tanData.getEl(2).toUpperCase() === 'J'
                  me.bpd.tan.hashType = tanData.getEl(3)
                  me.bpd.tan.tanVerfahren = {}
                  for (let i = 3; i < tanData.data.length; i++) {
                    var sicherheitsfunktion = {}
                    sicherheitsfunktion.code = tanData.data[i]
                    sicherheitsfunktion.oneTwoStepVers = tanData.data[i + 1] // "1": Einschrittverfahren, "2": Zweischritt
                    sicherheitsfunktion.techId = tanData.data[i + 2]
                    sicherheitsfunktion.zkaTanVerfahren = tanData.data[i + 3]
                    sicherheitsfunktion.versZkaTanVerf = tanData.data[i + 4]
                    sicherheitsfunktion.desc = tanData.data[i + 5]
                    sicherheitsfunktion.maxLenTan = tanData.data[i + 6]
                    sicherheitsfunktion.tanAlphanum = tanData.data[i + 7] === '2'
                    sicherheitsfunktion.txtRueckwert = tanData.data[i + 8]
                    sicherheitsfunktion.maxLenRueckwert = tanData.data[i + 9]
                    sicherheitsfunktion.anzTanlist = tanData.data[i + 10]
                    sicherheitsfunktion.multiTan = tanData.data[i + 11].toUpperCase() === 'J'
                    sicherheitsfunktion.tanZeitDiabez = tanData.data[i + 12]
                    sicherheitsfunktion.tanListNrReq = tanData.data[i + 13]
                    sicherheitsfunktion.auftragsstorno = tanData.data[i + 14].toUpperCase() === 'J'
                    sicherheitsfunktion.smsAbuKontoReq = tanData.data[i + 15]
                    sicherheitsfunktion.auftragKonto = tanData.data[i + 16]
                    sicherheitsfunktion.challangeClassReq = tanData.data[i + 17].toUpperCase() === 'J'
                    sicherheitsfunktion.challangeStructured = tanData.data[i + 18].toUpperCase() === 'J'
                    sicherheitsfunktion.initialisierungsMod = tanData.data[i + 19]
                    sicherheitsfunktion.bezTanMedReq = tanData.data[i + 20]
                    sicherheitsfunktion.anzSupportedTanVers = tanData.data[i + 21]
                    // sicherheitsfunktion.challangeValueReq = tanData.data[i+14].toUpperCase()=="J";
                    me.bpd.tan.tanVerfahren[sicherheitsfunktion.code] = sicherheitsfunktion
                    i += 21
                  }
                }
              } catch (ee) {
                me.log.gv.error(ee, {
                  gv: 'HITANS'
                }, 'Error while analyse HITANS')
              }
              // 6. Analysiere UPD
              try {
                var HIUPA = recvMsg.selectSegByName('HIUPA')[0]
                me.upd.versUpd = HIUPA.getEl(3)
                me.upd.geschaeftsVorgGesp = HIUPA.getEl(4) === '0' // UPDVerwendung
              } catch (ee) {
                me.log.gv.error(ee, {
                  gv: 'HIUPA'
                }, 'Error while analyse UPD')
              }
              // 7. Analysiere Verfügbare Tan Verfahren
              try {
                var HIRMSForTanv = recvMsg.selectSegByNameAndBelongTo('HIRMS', HKVVB.nr)[0]
                for (let i = 0; i !== HIRMSForTanv.store.data.length; i++) {
                  if (HIRMSForTanv.store.data[i].getEl(1) === '3920') {
                    me.upd.availibleTanVerfahren = []
                    for (var a = 3; a < HIRMSForTanv.store.data[i].data.length; a++) {
                      me.upd.availibleTanVerfahren.push(HIRMSForTanv.store.data[i].data[a])
                    }
                    if (me.upd.availibleTanVerfahren.length > 0) {
                      me.log.gv.info({
                        gv: 'HKVVB'
                      }, 'Update to use Tan procedure: ' + me.upd.availibleTanVerfahren[0])
                    }
                    break
                  }
                }
              } catch (ee) {
                me.log.gv.error(ee, {
                  gv: 'HKVVB'
                }, 'Error while analyse HKVVB result Tan Verfahren')
              }
              // 8. Analysiere Geschäftsvorfallparameter
              try {
                for (let i in recvMsg.segments) {
                  if (recvMsg.segments[i].name.length >= 6 && recvMsg.segments[i].name.charAt(5) === 'S') {
                    var gv = recvMsg.segments[i].name.substring(0, 5)
                    if (!(gv in me.bpd.gvParameters)) {
                      me.bpd.gvParameters[gv] = {}
                    }
                    me.bpd.gvParameters[gv][recvMsg.segments[i].vers] = recvMsg.segments[i]
                  }
                }
              } catch (ee) {
                me.log.gv.error(ee, {
                  gv: 'HKVVB'
                }, 'Error while analyse HKVVB result Tan Verfahren')
              }
              try {
                cb(error, recvMsg, hasNeuUrl)
              } catch (cbError) {
                me.log.gv.error(cbError, {
                  gv: 'HKVVB'
                }, 'Unhandled callback Error in HKVVB,HKIDN')
              }
            } catch (e) {
              me.log.gv.error(e, {
                gv: 'HKVVB'
              }, 'Error while analyse HKVVB Response')
              try {
                cb(e.toString(), null, false)
              } catch (cbError) {
                me.log.gv.error(cbError, {
                  gv: 'HKVVB'
                }, 'Unhandled callback Error in HKVVB,HKIDN')
              }
            }
          } else {
            me.log.gv.error({
              gv: 'HKVVB'
            }, 'Error while analyse HKVVB Response No Init Successful recv.')
            try {
              cb(new Error('Keine Initialisierung Erfolgreich Nachricht erhalten!'), recvMsg, false)
            } catch (cbError) {
              me.log.gv.error(cbError, {
                gv: 'HKVVB'
              }, 'Unhandled callback Error in HKVVB,HKIDN')
            }
          }
        } else {
          // Fehler schauen ob einer der Standardfehler, die gesondert behandelt werden
          // hier gibt es diverse fehlercode varianten, verhalten sich nicht nach doku
          // genaue identifikation des benutzer/pin falsch scheitert and zu vielen varianten + codes werden auch anderweitig genutzt
          /* if(Helper.checkMsgsWithBelongToForId(recvMsg,HKVVB.nr,"9931")||
             Helper.checkMsgsWithBelongToForId(recvMsg,HKVVB.nr,"9010")||
             Helper.checkMsgsWithBelongToForId(recvMsg,HNSHK.nr,"9210")||
             Helper.checkMsgsWithBelongToForId(recvMsg,HKIDN.nr,"9210")||
             Helper.checkMsgsWithBelongToForId(recvMsg,HKIDN.nr,"9010")){
             try{
               // 1. Benutzer nicht bekannt bzw. Pin falsch
               me.log.gv.error({gv:"HKVVB",hirmsg:HIRMG},"User not known or wrong pin");
               throw new Exceptions.WrongUserOrPinError();
             }catch(erThrown){
               try{
                 cb(erThrown,recvMsg,false);
               }catch(cbError){
                 me.log.gv.error(cbError,{gv:"HKVVB"},"Unhandled callback Error in HKVVB,HKIDN");
               }
             }
          }else{ */

          // anderer Fehler
          me.log.gv.error({
            gv: 'HKVVB',
            hirmsg: HIRMG
          }, 'Error while analyse HKVVB Response Wrong HIRMG response code')
          try {
            cb(new Error('Fehlerhafter Rückmeldungscode: ' + (HIRMG === null ? 'keiner' : HIRMG.getEl(1).getEl(3))), recvMsg, false)
          } catch (cbError) {
            me.log.gv.error(cbError, {
              gv: 'HKVVB'
            }, 'Unhandled callback Error in HKVVB,HKIDN')
          }
          // }
        }
      }
    })
  }

  me.MsgCheckAndEndDialog = function (recvMsg, cb) {
    var HIRMGs = recvMsg.selectSegByName('HIRMG')
    for (var k in HIRMGs) {
      for (var i in (HIRMGs[k].store.data)) {
        var ermsg = HIRMGs[k].store.data[i].getEl(1)
        if (ermsg === '9800') {
          try {
            cb(null, null)
          } catch (cbError) {
            me.log.gv.error(cbError, {
              gv: 'HKEND'
            }, 'Unhandled callback Error in HKEND')
          }
          return
        }
      }
    }
    MsgEndDialog(cb)
  }

  /**
  * Beendet eine Verbindung
  * @param {function} callback  optional if promise is possible
  * @return {promise} The optional Promise when no cb is given or Promise is undefined
  */
  me.MsgEndDialog = function (cb) {
    if (cb || typeof Promise !== 'function') { MsgEndDialog(cb) } else {
      return new Promise(function (resolve, reject) {
        MsgEndDialog(function (error, recvMsg) {
          if (error) { reject(error) } else { resolve(recvMsg) }
        })
      })
    }
  }

  function MsgEndDialog (cb) {
    var msg = new Nachricht(me.protoVersion)
    if (me.kundenId !== 9999999999) {
      msg.sign({
        'pin': me.pin,
        'tan': NULL,
        'sysId': me.sysId,
        'pinVers': me.upd.availibleTanVerfahren[0],
        'sigId': me.getNewSigId()
      })
    }
    msg.init(me.dialogId, me.nextMsgNr, me.blz, me.kundenId)
    me.nextMsgNr++
    msg.addSeg(Helper.newSegFromArray('HKEND', 1, [me.dialogId]))
    me.SendMsgToDestination(msg, function (error, recvMsg) {
      if (error) {
        me.log.gv.error(error, {
          gv: 'HKEND',
          msg: msg
        }, 'HKEND could not be send')
      }
      try {
        cb(error, recvMsg)
      } catch (cbError) {
        me.log.gv.error(cbError, {
          gv: 'HKEND'
        }, 'Unhandled callback Error in HKEND')
      }
    }, true)
  }

  // SEPA kontoverbindung anfordern HKSPA, HISPA ist die antwort
  me.MsgRequestSepa = function (forKonto, cb) {
    // Vars
    var processed = false
    var v1 = null
    var aufsetzpunktLoc = 0
    var sepaList = []
    // Create Segment
    if (forKonto) {
      v1 = [
        [280, forKonto]
      ]
      aufsetzpunktLoc = 2
    } else {
      v1 = []
      aufsetzpunktLoc = 1
    }
    // Start
    var reqSepa = new Order(me)
    reqSepa.msg({
      type: 'HKSPA',
      kiType: 'HISPA',
      aufsetzpunktLoc: [aufsetzpunktLoc],
      sendMsg: {
        1: v1,
        2: v1,
        3: v1
      },
      recvMsg: reqSepa.Helper().vers([1, 2, 3], function (segVers, relatedRespSegments, relatedRespMsgs, recvMsg) {
        try {
          if (reqSepa.checkMessagesOkay(relatedRespMsgs, true)) {
            var HISPA = reqSepa.getSegByName(relatedRespSegments, 'HISPA')
            if (HISPA !== null) {
              for (let i = 0; i !== HISPA.store.data.length; i++) {
                var verb = HISPA.getEl(i + 1)
                var o = {}
                o.isSepa = verb.getEl(1) === 'J'
                o.iban = verb.getEl(2)
                o.bic = verb.getEl(3)
                o.kontoNr = verb.getEl(4)
                o.unterKonto = verb.getEl(5)
                o.ctryCode = verb.getEl(6)
                o.blz = verb.getEl(7)
                sepaList.push(o)
              }
              try {
                cb(null, recvMsg, sepaList)
              } catch (cbError) {
                me.log.gv.error(cbError, {
                  gv: 'HKSPA'
                }, 'Unhandled callback Error in HKSPA')
              }
            } else {
              throw new Error('TODO ausführlicherer Error')
            }
          }
        } catch (e) {
          me.log.gv.error(e, {
            gv: 'HKSPA',
            msgs: relatedRespMsgs,
            segments: relatedRespSegments
          }, 'Exception while parsing HKSPA response')
          try {
            cb(e, null, null)
          } catch (cbError) {
            me.log.gv.error(cbError, {
              gv: 'HKSPA'
            }, 'Unhandled callback Error in HKSPA')
          }
        }
        processed = true
      }).done()
    })
    reqSepa.done(function (error, order, recvMsg) {
      if (error && !processed) {
        me.log.gv.error(error, {
          gv: 'HKSPA',
          recvMsg: recvMsg
        }, 'Exception while parsing HKSPA')
        try {
          cb(error, recvMsg, null)
        } catch (cbError) {
          me.log.gv.error(cbError, {
            gv: 'HKSPA'
          }, 'Unhandled callback Error in HKSPA')
        }
      } else if (!processed) {
        error = new Exceptions.InternalError('HKSPA response was not analysied')
        me.log.gv.error(error, {
          gv: 'HKSPA',
          recvMsg: recvMsg
        }, 'HKSPA response was not analysied')
        try {
          cb(error, recvMsg, null)
        } catch (cbError) {
          me.log.gv.error(cbError, {
            gv: 'HKSPA'
          }, 'Unhandled callback Error in HKSPA')
        }
      }
    })
  }

  /**
  * Lädt die Kontenumsätze für ein bestimmtes Konto
  * @param {object} konto  {iban,bic,kontoNr,unterKonto,ctryCode,blz}
  * @param {Date} fromDate  The date to start fromDate
  * @param {Date} toDate  The date to stop at
  * @param {function} callback  optional if promise is possible
  * @return {promise} The optional Promise when no cb is given or Promise is undefined
  */
  me.MsgGetKontoUmsaetze = function (konto, fromDate, toDate, cb) {
    if (cb || typeof Promise !== 'function') { MsgGetKontoUmsaetze(konto, fromDate, toDate, cb) } else {
      return new Promise(function (resolve, reject) {
        MsgGetKontoUmsaetze(konto, fromDate, toDate, function (error, recvMsg, umsaetze) {
          if (error) { reject(error) } else { resolve({recvMsg, umsaetze}) }
        })
      })
    }
  }

  function MsgGetKontoUmsaetze (konto, fromDate, toDate, cb) {
    var processed = false
    var v7 = null
    var v5 = null
    if (fromDate === null && toDate === null) {
      v5 = [
        [konto.kontoNr, konto.unterKonto, konto.ctryCode, konto.blz], 'N'
      ]
      v7 = [
        [konto.iban, konto.bic, konto.kontoNr, konto.unterKonto, konto.ctryCode, konto.blz], 'N'
      ]
    } else {
      v5 = [
        [konto.kontoNr, konto.unterKonto, konto.ctryCode, konto.blz], 'N', fromDate !== null ? Helper.convertDateToDFormat(fromDate) : '', toDate !== null ? Helper.convertDateToDFormat(toDate) : ''
      ]
      v7 = [
        [konto.iban, konto.bic, konto.kontoNr, konto.unterKonto, konto.ctryCode, konto.blz], 'N', fromDate !== null ? Helper.convertDateToDFormat(fromDate) : '', toDate !== null ? Helper.convertDateToDFormat(toDate) : ''
      ]
    }
    // Start
    var reqUmsaetze = new Order(me)
    var recv = function (segVers, relatedRespSegments, relatedRespMsgs, recvMsg) {
      try {
        if (reqUmsaetze.checkMessagesOkay(relatedRespMsgs, true)) {
          // Erfolgreich Meldung
          var txt = ''
          for (var i in relatedRespSegments) {
            if (relatedRespSegments[i].name === 'HIKAZ') {
              var HIKAZ = relatedRespSegments[i]
              txt += HIKAZ.getEl(1)
            }
          }
          var mtparse = new MTParser()
          mtparse.parse(txt)
          var umsatze = mtparse.getKontoUmsaetzeFromMT940()
          // Callback
          try {
            cb(null, recvMsg, umsatze)
          } catch (cbError) {
            me.log.gv.error(cbError, {
              gv: 'HKKAZ'
            }, 'Unhandled callback Error in HKKAZ')
          }
        }
      } catch (ee) {
        me.log.gv.error(ee, {
          gv: 'HKKAZ',
          respMsg: recvMsg
        }, 'Exception while parsing HKKAZ response')
        // Callback
        try {
          cb(ee, recvMsg, null)
        } catch (cbError) {
          me.log.gv.error(cbError, {
            gv: 'HKKAZ'
          }, 'Unhandled callback Error in HKKAZ')
        }
      }
      processed = true
    }
    // TODO check if we can do the old or the new version HKCAZ
    reqUmsaetze.msg({
      type: 'HKKAZ',
      kiType: 'HIKAZ',
      aufsetzpunktLoc: [6],
      sendMsg: {
        7: v7,
        5: v5
      },
      recvMsg: {
        7: recv,
        5: recv
      }
    })
    reqUmsaetze.done(function (error, order, recvMsg) {
      if (error && !processed) {
        me.log.gv.error(error, {
          gv: 'HKKAZ',
          recvMsg: recvMsg
        }, 'HKKAZ could not be send')
        // Callback
        try {
          cb(error, recvMsg, null)
        } catch (cbError) {
          me.log.gv.error(cbError, {
            gv: 'HKKAZ'
          }, 'Unhandled callback Error in HKKAZ')
        }
      } else if (!processed) {
        error = new Exceptions.InternalError('HKKAZ response was not analysied')
        me.log.gv.error(error, {
          gv: 'HKKAZ',
          recvMsg: recvMsg
        }, 'HKKAZ response was not analysied')
        // Callback
        try {
          cb(error, recvMsg, null)
        } catch (cbError) {
          me.log.gv.error(cbError, {
            gv: 'HKKAZ'
          }, 'Unhandled callback Error in HKKAZ')
        }
      }
    })
  }

  me.ConvertUmsatzeArrayToListofAllTransactions = function (umsaetze) {
    var result = []
    for (let i = 0; i !== umsaetze.length; i++) {
      for (var a = 0; a !== umsaetze[i].saetze.length; a++) {
        result.push(umsaetze[i].saetze[a])
      }
    }
    return result
  }

  /**
  * Lädt den Saldo eines bestimmten Kontos
  * @param {object} konto  Das Konto für das der Saldo geladen werden sollen: {iban,bic,kontoNr,unterKonto,ctryCode,blz}
  * @param {function} callback  optional if promise is possible
  * @return {promise} The optional Promise when no cb is given or Promise is undefined
  */
  me.MsgGetSaldo = function (konto, cb) {
    if (cb || typeof Promise !== 'function') { MsgGetSaldo(konto, cb) } else {
      return new Promise(function (resolve, reject) {
        MsgGetSaldo(konto, function (error, recvMsg, saldo) {
          if (error) { reject(error) } else { resolve({recvMsg, saldo}) }
        })
      })
    }
  }

  function MsgGetSaldo (konto, cb) {
    var reqSaldo = new Order(me)
    var processed = false
    var v5 = null
    var v7 = null
    var availSendMsg = {}
    if ('iban' in konto && 'bic' in konto && reqSaldo.checkKITypeAvailible('HISAL', [7])) {
      var kontoVerbInt = [konto.iban, konto.bic, konto.kontoNr, konto.unterKonto, konto.ctryCode, konto.blz]
      v7 = [kontoVerbInt, 'N']
      availSendMsg[7] = v7
    } else {
      var kontoVerb = [konto.kontoNr, konto.unterKonto, konto.ctryCode, konto.blz]
      v5 = [kontoVerb, 'N']
      availSendMsg[5] = v5
      availSendMsg[6] = v5
    }
    // Start
    reqSaldo.msg({
      type: 'HKSAL',
      kiType: 'HISAL',
      sendMsg: availSendMsg,
      recvMsg: reqSaldo.Helper().vers([5, 6, 7], function (segVers, relatedRespSegments, relatedRespMsgs, recvMsg) {
        try {
          if (reqSaldo.checkMessagesOkay(relatedRespMsgs, true)) {
            var HISAL = reqSaldo.getSegByName(relatedRespSegments, 'HISAL')
            if (HISAL !== null) {
              try {
                var result = {
                  desc: reqSaldo.getElFromSeg(HISAL, 2, null),
                  cur: reqSaldo.getElFromSeg(HISAL, 3, null),
                  saldo: Helper.getSaldo(HISAL, 4, false),
                  saldoVorgemerkt: Helper.getSaldo(HISAL, 5, false),
                  creditLine: Helper.getBetrag(HISAL, 6),
                  availAmount: Helper.getBetrag(HISAL, 7),
                  usedAmount: Helper.getBetrag(HISAL, 8),
                  overdraft: null,
                  bookingDate: null,
                  faelligkeitDate: Helper.getJSDateFromSeg(HISAL, 11)
                }
                if (segVers === 5) {
                  result.bookingDate = Helper.getJSDateFromSeg(HISAL, 9, 10)
                } else {
                  result.bookingDate = Helper.getJSDateFromSegTSP(HISAL, 11)
                  result.overdraft = Helper.getBetrag(HISAL, 9)
                }
                cb(null, recvMsg, result)
              } catch (cbError) {
                me.log.gv.error(cbError, {
                  gv: 'HKSAL'
                }, 'Unhandeled callback Error in HKSAL')
              }
            } else {
              throw new Error('TODO ausführlicherer Error')
            }
          }
        } catch (e) {
          me.log.gv.error(e, {
            gv: 'HKSAL',
            msgs: relatedRespMsgs,
            segments: relatedRespSegments
          }, 'Exception while parsing HKSAL response')
          try {
            cb(e, null, null)
          } catch (cbError) {
            me.log.gv.error(cbError, {
              gv: 'HKSAL'
            }, 'Unhandeled callback Error in HKSAL')
          }
        }
        processed = true
      }).done()
    })
    reqSaldo.done(function (error, order, recvMsg) {
      if (error && !processed) {
        me.log.gv.error(error, {
          gv: 'HKSAL',
          recvMsg: recvMsg
        }, 'Exception while parsing HKSAL')
        try {
          cb(error, recvMsg, null)
        } catch (cbError) {
          me.log.gv.error(cbError, {
            gv: 'HKSAL'
          }, 'Unhandeled callback Error in HKSAL')
        }
      } else if (!processed) {
        error = new Exceptions.InternalError('HKSAL response was not analysed')
        me.log.gv.error(error, {
          gv: 'HKSAL',
          recvMsg: recvMsg
        }, 'HKSAL response was not analysed')
        try {
          cb(error, recvMsg, null)
        } catch (cbError) {
          me.log.gv.error(cbError, {
            gv: 'HKSAL'
          }, 'Unhandled callback Error in HKSAL')
        }
      }
    })
  }

  me.MsgSEPASingleTransfer = function (debtAccount, credAccount, credName, description, amount, cb) {
    // 1. Eingangsparameter prüfen
    // TODO
    // 1.1 prüfen ob unser SEPA schema in HISPAS ist
    // TODO
    // 2. SEPA sepade:xsd:pain.001.003.03.xsd generieren siehe https://www.firmenkunden.commerzbank.de/files/formats/datenformateSepaKundeBankV2-7.pdf
    var xml = '<?xml version="1.0" encoding="utf-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03 pain.001.003.03.xsd"><CstmrCdtTrfInitn>'
    xml += '<GrpHdr><MsgId>MID' + '20150203201401' + '</MsgId>'
    xml += '<CreDtTm>' + '2015-02-03T20:14:01Z' + '</CreDtTm>'
    xml += '<NbOfTxs>1</NbOfTxs><CtrlSum>' + '1.00' + '</CtrlSum>'
    xml += '<InitgPty>MsgSEPASingleTransfer<Nm>' + 'Fullname' + '</Nm></InitgPty></GrpHdr>'
    // TODO
    // 3. HKCCS und HKTAN mit 4 senden
    // TODO
  }

  /**
  * Vereinfachte Variante um eine Verbindung mit der Bank aufzubauen
  * @param {function} callback  optional if promise is possible
  * @return {promise} The optional Promise when no cb is given or Promise is undefined
  */
  me.EstablishConnection = function (cb) {
    if (cb || typeof Promise !== 'function') { EstablishConnection(cb) } else {
      return new Promise(function (resolve, reject) {
        EstablishConnection(function (error) {
          if (error) { reject(error) } else { resolve() }
        })
      })
    }
  }

  function EstablishConnection (cb) {
    var protocolSwitch = false
    var versStep = 1
    var originalBpd = me.bpd.clone()
    originalBpd.clone = me.bpd.clone
    var originalUpd = me.upd.clone()
    originalUpd.clone = me.upd.clone
    // 1. Normale Verbindung herstellen um BPD zu bekommen und evtl. wechselnde URL ( 1.versVersuch FinTS 2. versVersuch HBCI2.2 )
    // 2. Verbindung mit richtiger URL um auf jeden Fall (auch bei geänderter URL) die richtigen BPD zu laden + Tan Verfahren herauszufinden
    // 3. Abschließende Verbindung aufbauen
    var performStep = function (step) {
      me.MsgInitDialog(function (error, recvMsg, hasNeuUrl) {
        if (error) {
          me.MsgCheckAndEndDialog(recvMsg, function (error2, recvMsg2) {
            if (error2) {
              me.log.conest.error({
                step: step,
                error: error2
              }, 'Connection close failed.')
            } else {
              me.log.conest.debug({
                step: step
              }, 'Connection closed okay.')
            }
          })
          // Wurde Version 300 zuerst probiert, kann noch auf Version 220 gewechselt werden, dazu:
          // Prüfen ob aus der Anfrage Nachricht im Nachrichtenheader(=HNHBK) die Version nicht akzeptiert wurde
          // HNHBK ist immer Segment Nr. 1
          // Version steht in Datenelement Nr. 3
          // ==> Ist ein HIRMS welches auf HNHBK mit Nr. 1 referenziert vorhanden ?
          // ==> Hat es den Fehlercode 9120 = "nicht erwartet" ?
          // ==> Bezieht es sich auf das DE Nr. 3 ?
          var HIRMS = recvMsg.selectSegByNameAndBelongTo('HIRMS', 1)[0]
          if (me.protoVersion === 300 && HIRMS && HIRMS.getEl(1).getEl(1) === '9120' && HIRMS.getEl(1).getEl(2) === '3') {
            // ==> Version wird wohl nicht unterstützt, daher neu probieren mit HBCI2 Version
            me.log.conest.debug({
              step: step,
              hirms: HIRMS
            }, 'Version 300 nicht unterstützt, Switch Version from FinTS to HBCI2.2')
            me.protoVersion = 220
            versStep = 2
            protocolSwitch = true
            me.clear()
            performStep(1)
          } else {
            // Anderer Fehler
            me.log.conest.error({
              step: step,
              error: error
            }, 'Init Dialog failed: ' + error)
            try {
              cb(error)
            } catch (cbError) {
              me.log.conest.error(cbError, {
                step: step
              }, 'Unhandled callback Error in EstablishConnection')
            }
          }
        } else {
          // Erfolgreich Init Msg verschickt
          me.log.conest.debug({
            step: step,
            bpd: beautifyBPD(me.bpd),
            upd: me.upd,
            url: me.bpd.url,
            newSigMethod: me.upd.availibleTanVerfahren[0]
          }, 'Init Dialog successful.')
          if (step === 1 || step === 2) {
            // Im Step 1 und 2 bleiben keine Verbindungen erhalten
            // Diese Verbindung auf jeden Fall beenden
            var neuUrl = me.bpd.url
            var neuSigMethod = me.upd.availibleTanVerfahren[0]
            me.bpd = originalBpd.clone()
            me.upd = originalUpd.clone()
            var origSysId = me.sysId
            var origLastSig = me.lastSignaturId
            me.MsgCheckAndEndDialog(recvMsg, function (error2, recvMsg2) {
              if (error2) {
                me.log.conest.error({
                  step: step,
                  error: error2
                }, 'Connection close failed.')
              } else {
                me.log.conest.debug({
                  step: step
                }, 'Connection closed okay.')
              }
            })
            me.clear()
            me.bpd.url = neuUrl
            me.upd.availibleTanVerfahren[0] = neuSigMethod
            me.sysId = origSysId
            me.lastSignaturId = origLastSig
            originalBpd.url = me.bpd.url
            originalUpd.availibleTanVerfahren[0] = neuSigMethod
          }

          if (hasNeuUrl) {
            if (step === 1) {
              // Im Step 1 ist das eingeplant, dass sich die URL ändert
              me.log.conest.debug({
                step: 2
              }, 'Start Connection in Step 2')
              performStep(2)
            } else {
              // Wir unterstützen keine mehrfach Ändernden URLs
              if (step === 3) {
                me.bpd = originalBpd.clone()
                me.upd = originalUpd.clone()
                me.MsgCheckAndEndDialog(recvMsg, function (error2, recvMsg2) {
                  if (error2) {
                    me.log.conest.error({
                      step: step,
                      error: error2
                    }, 'Connection close failed.')
                  } else {
                    me.log.conest.debug({
                      step: step
                    }, 'Connection closed okay.')
                  }
                })
              }
              me.log.conest.error({
                step: step
              }, 'Multiple URL changes are not supported!')
              // Callback
              try {
                cb(new Error('Mehrfachänderung der URL ist nicht unterstützt!'))
              } catch (cbError) {
                me.log.conest.error(cbError, {
                  step: step
                }, 'Unhandled callback Error in EstablishConnection')
              }
            }
          } else if (step === 1 || step === 2) {
            // 3: eigentliche Verbindung aufbauen
            me.log.conest.debug({
              step: 3
            }, 'Start Connection in Step 3')
            performStep(3)
          } else {
            // Ende Schritt 3 = Verbindung Ready
            me.log.conest.debug({
              step: step
            }, 'Connection entirely established. Now get the available accounts.')
            // 4. Bekomme noch mehr Details zu den Konten über HKSPA
            me.MsgRequestSepa(null, function (error, recvMsg2, sepaList) {
              if (error) {
                me.log.conest.error({
                  step: step
                }, 'Error getting the available accounts.')
                me.MsgCheckAndEndDialog(recvMsg, function (error3, recvMsg2) {
                  if (error3) {
                    me.log.conest.error({
                      step: step,
                      error: error3
                    }, 'Connection close failed.')
                  } else {
                    me.log.conest.debug({
                      step: step
                    }, 'Connection closed okay.')
                  }
                })
                // Callback
                try {
                  cb(error)
                } catch (cbError) {
                  me.log.conest.error(cbError, {
                    step: step
                  }, 'Unhandled callback Error in EstablishConnection')
                }
              } else {
                // Erfolgreich die Kontendaten geladen, diese jetzt noch in konto mergen und Fertig!
                for (let i = 0; i !== sepaList.length; i++) {
                  for (var j = 0; j !== me.konten.length; j++) {
                    if (me.konten[j].kontoNr === sepaList[i].kontoNr &&
                      me.konten[j].unterKonto === sepaList[i].unterKonto) {
                      me.konten[j].sepaData = sepaList[i]
                      break
                    }
                  }
                }
                // Fertig
                me.log.conest.debug({
                  step: step,
                  recvSepaList: sepaList
                }, 'Connection entirely established and got available accounts. Return.')
                // Callback
                try {
                  cb(null)
                } catch (cbError) {
                  me.log.conest.error(cbError, {
                    step: step
                  }, 'Unhandled callback Error in EstablishConnection')
                }
              }
            })
          }
        }
      })
    }
    me.log.conest.debug({
      step: 1
    }, 'Start First Connection')
    performStep(1)
  }

  //
  me.SendMsgToDestination = function (msg, callback, inFinishing) { // Parameter für den Callback sind error,data
    // Ensure the sequence of messages!
    if (!inFinishing) {
      if (me.inConnection) {
        throw new Exceptions.OutofSequenceMessageException()
      }
      me.inConnection = true
    }
    var intCallback = function (param1, param2) {
      if (!inFinishing) {
        me.inConnection = false
      }
      callback(param1, param2)
    }
    var txt = msg.transformForSend()
    me.debugLogMsg(txt, true)
    var postData = Buffer.from(txt).toString('base64')
    var u = url.parse(me.bpd.url)
    var options = {
      hostname: u.hostname,
      port: u.port,
      path: u.path,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': postData.length
      }
    }
    var data = ''
    var prot = u.protocol === 'http:' ? http : https
    me.log.con.debug({
      host: u.hostname,
      port: u.port,
      path: u.path
    }, 'Connect to Host')
    var req = prot.request(options, function (res) { // https.request(options, function(res) {
      res.on('data', function (chunk) {
        data += chunk
      })
      res.on('end', function () {
        // Hier wird dann weiter gemacht :)
        me.log.con.debug({
          host: u.hostname,
          port: u.port,
          path: u.path
        }, 'Request finished')
        var clearTxt = encoding.convert(Buffer.from(data, 'base64'), 'UTF8', 'ISO88591').toString('utf8') // TODO: this only applies for HBCI? can we dynamically figure out the charset?
        me.debugLogMsg(clearTxt, false)
        try {
          var MsgRecv = new Nachricht(me.protoVersion)
          MsgRecv.parse(clearTxt)
          intCallback(null, MsgRecv)
        } catch (e) {
          me.log.con.error(e, 'Could not parse received Message')
          intCallback(e.toString(), null)
        }
      })
    })
    req.on('error', function () {
      // Hier wird dann weiter gemacht :)
      me.log.con.error({
        host: u.hostname,
        port: u.port,
        path: u.path
      }, 'Could not connect to ' + options.hostname)
      intCallback(new Exceptions.ConnectionFailedException(u.hostname, u.port, u.path), null)
    })
    req.write(postData)
    req.end()
  }

  me.debugLogMsg = function (txt, send) {
    me.log.con.trace({
      rawData: txt,
      sendOrRecv: send ? 'send' : 'recv'
    }, 'Connection Data Trace')
    if (me.debugMode) {
      console.log((send ? 'Send: ' : 'Recv: ') + txt)
    }
  }
}

module.exports = FinTSClient
