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
var https = require('https')
var http = require('http')
var url = require('url')
var bankenliste = require('./bankenliste.js')
var classes = require('./Classes.js')
var Konto = classes.Konto
var NULL = classes.NULL
var Nachricht = classes.Nachricht
var Helper = classes.Helper
var MTParser = require('./MTParser.js')

/*
  FinTSClient(inBlz,inKundenId,inPin)
    inBlz       Die entsprechende BLZ als Zahl oder String
    inKundenId   Die Benutzerkennung bzw. KundenID  9999999999 = Anonymer Benutzer
    inPin       Die Pin

  Attribute
    = Notwendig um die Verbindung herzustellen =
    blz
    ctry       Zurzeit immer 280 für Deutschland
    kundenId
    pin
    tan         Noch NULL, da keine Geschäftsvorfälle mit Tan zurzeit unterstützt
    debugMode     Debug Modus (Logging)

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
      callback (function(error,recvMsg,hasNeuUrl))   error === null Kein Fehler
                               recvMsg (Nachricht)
                               hasNeuUrl === true wenn eine andere URL zurückgemeldet wurde
    MsgEndDialog(callback)         Beendet einen Dialog
      callback (function(error,recvMsg))         error === null kein Fehler
                               recvMsg (Nachricht)
    EstablishConnection(callback)     Vereinfachte Variante um eine Verbindung mit der Bank aufzubauen
      callback (function(error))             error === null kein Fehler
                                  !== null Fehler / ein MsgEndDialog ist nichtmehr erforderlich
    MsgRequestSepa(forKontoNr,callback)  Lade SEPA Zusatz Daten (vor allem die BIC)
      forKontoNr                   KontoNr für das betreffende Konto, kann aber auch weg gelassen werden, dann für alle Konten
      callback (function(error,recvMsg,sepaList))  Error === null kein Fehler
                              RecvMsg (Nachricht)
                              SepaList [] array von Sepa Daten Format siehe UPD Konten[].sepaData
    MsgGetKontoUmsaetze(konto,fromDate,toDate,callback)  Lädt die Kontenumsätze für ein bestimmtes Konto
      konto                       Das Konto für das die Umsätze geladen werden sollen
      fromDate (Date)                 vom Datum (können leer==null gelassen werden dann wird alles verfügbare geladen)
      toDate    (Date)                 zum Datum
      callback  (function(error,recvMsg,umsaetze))   error === null kein Fehler
                               recvMsg (Nachricht)
                               umsaetze [] Enthält die Umsatz Daten mit folgendem Format
                              [{      // pro Tag ein Objekt siehe MT490 SWIFT Format
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
                                        'textKeyAddion':""
                                      }
                                  }
                                ]
                              }]
    closeSecure ()        Stellt sicher, dass keine Sensiblen Informationen wie die PIN noch im RAM sind, sollte am Ende immer gerufen werden

*/
var FinTSClient = function (inBlz, inKundenId, inPin, bankenlist) {
  var me = this
  me.blz = inBlz
  me.ctry = 280
  me.kundenId = inKundenId
  me.pin = inPin
  me.tan = NULL
  me.debugMode = false

  // Technical
  me.dialogId = 0
  me.nextMsgNr = 1
  me.clientName = 'OpenFinTSJSClient'
  me.clientVersion = 1

  // BPD und SystemId mit Letzt benutzter Signatur ID
  me.sysId = 0
  me.lastSignaturId = 1
  me.bpd = { }
  me.bpd.url = ''

  // UPD  Data
  me.upd = { }
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
        'tanVerfahren': {'999': {
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
        }}
      },
      'clone': function () { return JSON.parse(JSON.stringify(this)) }

    }
    me.bpd.url = bankenlist === undefined ? bankenliste['' + inBlz].url : bankenlist['' + inBlz].url

    me.upd = {
      'versUpd': '0',
      'geschaeftsVorgGesp': true,
      'availibleTanVerfahren': ['999'],
      'clone': function () { return JSON.parse(JSON.stringify(this)) }
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
    var msg = new Nachricht()
    if (me.kundenId !== 9999999999)msg.sign({'pin': me.pin, 'tan': NULL, 'sysId': me.sysId, 'pinVers': me.upd.availibleTanVerfahren[0], 'sigId': me.getNewSigId()})
    msg.init(me.dialogId, me.nextMsgNr, me.blz, me.kundenId)
    me.nextMsgNr++
    //  KundensystemID  = 0; Kundensystemssatus = 0
    msg.addSeg(Helper.newSegFromArray('HKIDN', 2, [[me.ctry, me.blz], me.kundenId, me.sysId, 1]))
    // BPD Vers = 0; UPD Vers = 0; Dialogspr. = 0
    var HKVVB = Helper.newSegFromArray('HKVVB', 3, [me.bpd.versBpd, me.upd.versUpd, 0, me.clientName, me.clientVersion])
    msg.addSeg(HKVVB)
    if (me.kundenId !== 9999999999 && me.sysId === 0) var syn = msg.addSeg(Helper.newSegFromArray('HKSYN', 3, [0]))// Synchronisierung starten
    me.SendMsgToDestination(msg, function (error, recvMsg) {
      if (error) {
        console.log('Ein fehler aufgetreten: ' + error.toString())
        cb(error, recvMsg, false)
      } else {
        // Prüfen ob Erfolgreich
        var HIRMG = null
        try { HIRMG = recvMsg.selectSegByName('HIRMG')[0] } catch (e) {};
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
              var neuUrl = Helper.convertFromToJSText(recvMsg.selectSegByName('HIKOM')[0].getEl(3).getEl(2))
              var hasNeuUrl = false
              if (neuUrl !== me.bpd.url) {
                hasNeuUrl = true
              }
              // 4. Mögliche KontoInformationen
              if (me.konten.length === 0) {
                var kontoList = recvMsg.selectSegByName('HIUPD')
                for (var i = 0; i !== kontoList.length; i++) {
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
              } catch (ee) {}
              try {
              // 5.3 Pins
                var pinData = recvMsg.selectSegByName('HIPINS')[0].getEl(4)
                me.bpd.pin.minLength = pinData.getEl(1)
                me.bpd.pin.maxLength = pinData.getEl(2)
                me.bpd.pin.maxTanLength = pinData.getEl(3)
                me.bpd.pin.txtBenutzerkennung = pinData.getEl(4)
                me.bpd.pin.txtKundenId = pinData.getEl(5)
                // 5.3.2 Tanerforderlichkeit für die Geschäftsvorfälle
                me.bpd.pin.availibleSeg = {}// true and false für ob Tan erforderlich
                for (var i = 5; i < pinData.data.length; i++) {
                  me.bpd.pin.availibleSeg[pinData.data[i]] = pinData.data[i + 1].toUpperCase() === 'J'
                  i++
                }
              } catch (ee) {}
              try {
              // 5.4 Tan
                var HITANS = recvMsg.selectSegByName('HITANS')[0]
                if (HITANS.vers === 5) {
                  var tanData = HITANS.getEl(4)
                  me.bpd.tan.oneStepAvailible = tanData.getEl(1).toUpperCase() === 'J'
                  me.bpd.tan.multipleTan = tanData.getEl(2).toUpperCase() === 'J'
                  me.bpd.tan.hashType = tanData.getEl(3)
                  me.bpd.tan.tanVerfahren = {}
                  for (var i = 3; i < tanData.data.length; i++) {
                    var sicherheitsfunktion = {}
                    sicherheitsfunktion.code = tanData.data[i]
                    sicherheitsfunktion.oneTwoStepVers = tanData.data[i + 1]// "1": Einschrittverfahren, "2": Zweischritt
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
              } catch (ee) {}
              // 6. Analysiere UPD
              try {
                var HIUPA = recvMsg.selectSegByName('HIUPA')[0]
                me.upd.versUpd = HIUPA.getEl(3)
                me.upd.geschaeftsVorgGesp = HIUPA.getEl(4) === '0' // UPDVerwendung
              } catch (ee) {}
              // 7. Analysiere Verfügbare Tan Verfahren
              try {
                var HIRMSForTanv = recvMsg.selectSegByNameAndBelongTo('HIRMS', HKVVB.nr)[0]
                for (var i = 0; i !== HIRMSForTanv.store.data.length; i++) {
                  if (HIRMSForTanv.store.data[i].getEl(1) === '3920') {
                    me.upd.availibleTanVerfahren = []
                    for (var a = 3; a < HIRMSForTanv.store.data[i].data.length; a++) {
                      me.upd.availibleTanVerfahren.push(HIRMSForTanv.store.data[i].data[a])
                    }
                    break
                  }
                }
              } catch (ee) {}
              cb(error, recvMsg, hasNeuUrl)
            } catch (e) {
              cb(e.toString(), null, false)
            }
          } else {
            cb('Keine Initialisierung Erfolgreich Nachricht erhalten!', recvMsg, false)
          }
        } else {
          cb('Fehlerhafter Rückmeldungscode: ' + (HIRMG === null ? 'keiner' : HIRMG.getEl(1).getEl(3)), recvMsg, false)
        }
      }
    })
  }

  me.MsgEndDialog = function (cb) {
    var msg = new Nachricht()
    if (me.kundenId !== 9999999999)msg.sign({'pin': me.pin, 'tan': NULL, 'sysId': me.sysId, 'pinVers': me.upd.availibleTanVerfahren[0], 'sigId': me.getNewSigId()})
    msg.init(me.dialogId, me.nextMsgNr, me.blz, me.kundenId)
    me.nextMsgNr++
    msg.addSeg(Helper.newSegFromArray('HKEND', 1, [me.dialogId]))
    me.SendMsgToDestination(msg, function (error, recvMsg) {
      if (error) {
        console.log('Ein Fehler ist aufgetreten: ' + error.toString())
        cb(error, recvMsg)
      } else {
        cb(error, recvMsg)
      }
    })
  }

  // SEPA kontoverbindung anfordern HKSPA, HISPA ist die antwort
  me.MsgRequestSepa = function (forKonto, cb) {
    var msg = new Nachricht()
    msg.sign({'pin': me.pin, 'tan': NULL, 'sysId': me.sysId, 'pinVers': me.upd.availibleTanVerfahren[0], 'sigId': me.getNewSigId()})
    msg.init(me.dialogId, me.nextMsgNr, me.blz, me.kundenId)
    me.nextMsgNr++
    var kontoVerb = null
    if (forKonto) {
      kontoVerb = [280, forKonto]
    }
    forKonto === null ? msg.addSeg(Helper.newSegFromArray('HKSPA', 1, []))
      : msg.addSeg(Helper.newSegFromArray('HKSPA', 1, [kontoVerb]))
    me.SendMsgToDestination(msg, function (error, recvMsg) {
      if (error) {
        console.log('Ein Fehler ist aufgetreten: ' + error.toString())
        cb(error, recvMsg, null)
      } else {
        try {
          var hispa = recvMsg.selectSegByName('HISPA')[0]
          var sepaList = new Array()
          for (var i = 0; i !== hispa.store.data.length; i++) {
            var verb = hispa.getEl(i + 1)
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
          cb(error, recvMsg, sepaList)
        } catch (ee) {
          cb(ee.toString(), null, null)
        }
      }
    })
  }

  /*
    konto = {iban,bic,kontoNr,unterKonto,ctryCode,blz}
    fromDate
    toDate    können null sein
    cb
  */
  me.MsgGetKontoUmsaetze = function (konto, fromDate, toDate, cb) {
    var msg = new Nachricht()
    msg.sign({'pin': me.pin, 'tan': NULL, 'sysId': me.sysId, 'pinVers': me.upd.availibleTanVerfahren[0], 'sigId': me.getNewSigId()})
    msg.init(me.dialogId, me.nextMsgNr, me.blz, me.kundenId)
    me.nextMsgNr++
    // Segmente
    if (fromDate === null && toDate === null) {
      var HKKAZ = Helper.newSegFromArray('HKKAZ', 7, [[konto.iban, konto.bic, konto.kontoNr, konto.unterKonto, konto.ctryCode, konto.blz], 'N'])
    } else {
      var HKKAZ = Helper.newSegFromArray('HKKAZ', 7, [[konto.iban, konto.bic, konto.kontoNr, konto.unterKonto, konto.ctryCode, konto.blz], 'N', Helper.convertDateToDFormat(fromDate), Helper.convertDateToDFormat(toDate)])
    }
    msg.addSeg(HKKAZ)
    // abschicken
    me.SendMsgToDestination(msg, function (error, recvMsg) {
      if (error) {
        console.log('Ein Fehler ist aufgetreten: ' + error.toString())
        cb(error, recvMsg, null)
      } else {
        try {
          var hirms = recvMsg.selectSegByNameAndBelongTo('HIRMS', HKKAZ.nr)[0]
          if (hirms.getEl(1).getEl(1) === '0020') {
            // Erfolgreich Meldung
            var txt = recvMsg.selectSegByName('HIKAZ')[0].getEl(1)
            var mtparse = new MTParser()
            mtparse.parse(txt)
            var umsatze = mtparse.getKontoUmsaetzeFromMT490()
            cb(error, recvMsg, umsatze)
          } else {
            // Fehlermeldung
            cb('Fehlerrückmeldung: ' + hirms.getEl(1).getEl(1) + '  ' + hirms.getEl(1).getEl(3), recvMsg, null)
          }
        } catch (ee) {
          cb(ee.toString(), recvMsg, null)
        }
      }
    })
  }
  /*
    debtAccount: {iban:"",bic:""} Konto von dem aus überwiesen werden soll
    credAccount: {iban:"",bic:""} Konto des Begünstigten
    credName: ""           Name des Begünstigten
    description: ""           Verwendungszweck
    amount: 0.00           Betrag in Euro mit maximal zwei Nachkommastellen
    cb: function(error,rMsg,sendTanResponse=function(tan,cbToTan))

    cbToTan : function(error,rMsg)
  */
  me.MsgSEPASingleTransfer = function (debtAccount, credAccount, credName, description, amount, cb) {
    // 1. Eingangsparameter prüfen
    // TODO
    // 1.1 prüfen ob unser SEPA schema in HISPAS ist
    // TODO
    // 2. SEPA sepade:xsd:pain.001.003.03.xsd generieren siehe https://www.firmenkunden.commerzbank.de/files/formats/datenformateSepaKundeBankV27.pdf
    var xml = '<?xml version="1.0" encoding="utf8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03" xmlns:xsi="http://www.w3.org/2001/XMLSchemaInstance" xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03 pain.001.003.03.xsd"><CstmrCdtTrfInitn>'
    xml += '<GrpHdr><MsgId>MID' + '20150203201401' + '</MsgId>'
    xml += '<CreDtTm>' + '2015-02-03T20:14:01Z' + '</CreDtTm>'
    xml += '<NbOfTxs>1</NbOfTxs><CtrlSum>' + 1.00 + '</CtrlSum>'
    xml += '<InitgPty><Nm>' + Fullname + '</Nm></InitgPty></GrpHdr>'
    // TODO
    // 3. HKCCS und HKTAN mit 4 senden
    // TODO
  }

  me.EstablishConnection = function (cb) {
    var originalBpd = me.bpd.clone(); originalBpd.clone = me.bpd.clone
    var originalUpd = me.upd.clone(); originalUpd.clone = me.upd.clone
    // 1. Normale Verbindung herstellen um BPD zu bekommen und evtl. wechselnde URL
    // 2. Verbindung mit richtiger URL um auf jeden Fall (auch bei geänderter URL) die richtigen BPD zu laden + Tan Verfahren herauszufinden
    // 3. Abschließende Verbindung aufbauen
    var performStep = function (step) {
      me.MsgInitDialog(function (error, recvMsg, hasNeuUrl) {
        if (error) {
          cb(error)
        } else {
          // Erfolgreich Init Msg verschickt
          if (step === 1 || step === 2) {
            // Im Step 1 und 2 bleiben keine Verbindungen erhalten
            // Diese Verbindung auf jeden Fall beenden
            var neuUrl = me.bpd.url
            var neuSigMethod = me.upd.availibleTanVerfahren[0]
            me.bpd = originalBpd.clone()
            me.upd = originalUpd.clone()
            var origSysId = me.sysId
            var origLastSig = me.lastSignaturId
            me.MsgEndDialog(function (error2, recvMsg2) {})
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
              performStep(2)
            } else {
              // Wir unterstützen keine mehrfach Ändernden URLs
              if (step === 3) {
                me.bpd = originalBpd.clone()
                me.upd = originalUpd.clone()
                me.MsgEndDialog(function (error2, recvMsg2) {})
              }
              cb('Mehrfachänderung der URL ist nicht unterstützt!')
            }
          } else if (step === 1 || step === 2) {
            // 3: eigentliche Verbindung aufbauen
            performStep(3)
          } else {
            // Ende Schritt 3 = Verbindung Ready
            // 4. Bekomme noch mehr Details zu den Konten über HKSPA
            me.MsgRequestSepa(null, function (error, recvMsg2, sepaList) {
              if (error) {
                me.MsgEndDialog(function (error3, recvMsg2) {})
                cb(error)
              } else {
                // Erfolgreich die Kontendaten geladen, diese jetzt noch in konto mergen und Fertig!
                for (var i = 0; i !== sepaList.length; i++) {
                  for (var j = 0; j !== me.konten.length; j++) {
                    if (me.konten[j].kontoNr === sepaList[i].kontoNr &&
                       me.konten[j].unterKonto === sepaList[i].unterKonto) {
                      me.konten[j].sepaData = sepaList[i]
                      break
                    }
                  }
                }
                // Fertig
                cb(null)
              }
            })
          }
        }
      })
    }
    performStep(1)
  }

  //
  me.SendMsgToDestination = function (msg, callback) { // Parameter für den Callback sind error,data
    var txt = msg.transformForSend()
    me.debugLogMsg(txt, true)
    var postData = new Buffer(txt).toString('base64')
    var u = url.parse(me.bpd.url)
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
    var prot = u.protocol === 'http:' ? http : https
    var req = prot.request(options, function (res) { // https.request(options, function(res) {
      res.on('data', function (chunk) {
        data += chunk
      })
      res.on('end', function () {
      // Hir wird dann weiter gemacht :)
        var clearTxt = new Buffer(data, 'base64').toString('utf8')
        me.debugLogMsg(clearTxt, false)
        try {
          var MsgRecv = new Nachricht()
          MsgRecv.parse(clearTxt)
          callback(null, MsgRecv)
        } catch (e) {
          callback(e.toString(), null)
        }
      })
    })

    req.on('error', function () {
      // Hier wird dann weiter gemacht :)
      callback('Could not connect to ' + options.hostname, null)
    })
    req.write(postData)
    req.end()
  }

  me.debugLogMsg = function (txt, send) {
    if (me.debugMode) { console.log((send ? 'Send: ' : 'Recv: ') + txt) }
  }
}

module.exports = FinTSClient
