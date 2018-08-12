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
var util = require('util')
var pClasses = require('./Parser.js')
var Parser = pClasses.Parser
var ParseError = pClasses.ParseError

var Konto = function () {
  var meKonto = this
  meKonto.iban = ''
  meKonto.kontoNr = ''
  meKonto.unterKontoMerkm = null
  meKonto.ctryCode = ''
  meKonto.blz = ''
  meKonto.kundenId = ''
  meKonto.kontoart = ''
  meKonto.currency = ''
  meKonto.kunde1Name = ''
  meKonto.productName = ''
}

var NULL = new function () {
  this.id = 1234
}()

var ByteVal = function (ddd) {
  this.data = ddd
}

var Helper = new function () {
  this.checkMsgsWithBelongToForId = function (msg, bez, id) {
    var array = msg.selectSegByNameAndBelongTo('HIRMS', bez)
    if (array.length > 0) {
      for (let i = 0; i !== array.length; i++) {
        for (var a = 0; a !== array[i].store.data.length; a++) {
          var d = array[i].store.data[a]
          if (d.getEl(1) === id) {
            return d
          }
        }
      }
      return null
    } else {
      return null
    }
  }

  this.getNrWithLeadingNulls = function (nr, len) {
    var stxt = nr + ''
    var ltxt = ''
    var neu = len - stxt.length
    for (let i = 0; i !== neu; i++) {
      ltxt += '0'
    }
    ltxt += stxt
    return ltxt
  }

  this.newSegFromArrayWithBez = function (name, vers, bez, ar) {
    var seg = this.newSegFromArray(name, vers, ar)
    seg.bez = bez
    return seg
  }

  this.newSegFromArray = function (name, vers, ar) {
    var seg = new Segment()
    seg.init(name, 0, vers, 0)
    for (let i = 0; i !== ar.length; i++) {
      if (ar[i] instanceof Array) {
        var neu = new DatenElementGruppe()
        for (var j = 0; j !== ar[i].length; j++) {
          if (ar[i][j] instanceof ByteVal) {
            neu.addDEbin(ar[i][j].data)
          } else {
            neu.addDE(ar[i][j])
          }
        }
        seg.store.addDEG(neu)
      } else if (ar[i] instanceof ByteVal) {
        seg.store.addDEbin(ar[i].data)
      } else {
        // normales datenelement
        seg.store.addDE(ar[i])
      }
    }
    return seg
  }

  this.convertIntoArray = function (deOrDeg) {
    if (deOrDeg instanceof DatenElementGruppe) {
      var r = []
      for (let i = 0; i !== deOrDeg.data.length; i++) {
        r.push(deOrDeg.data[i])
      }
      return r
    } else {
      return [deOrDeg]
    }
  }

  this.convertDateToDFormat = function (date) {
    var yyyy = date.getFullYear() + ''
    var mm = ((date.getMonth() + 1) <= 9) ? ('0' + (date.getMonth() + 1)) : ((date.getMonth() + 1) + '')
    var dd = (date.getDate() <= 9) ? ('0' + date.getDate()) : (date.getDate() + '')
    return yyyy + mm + dd
  }

  this.convertDateToTFormat = function (date) {
    var hh = ((date.getHours() <= 9) ? '0' : '') + date.getHours()
    var mm = ((date.getMinutes() <= 9) ? '0' : '') + date.getMinutes()
    var ss = ((date.getSeconds() <= 9) ? '0' : '') + date.getSeconds()
    return hh + mm + ss
  }

  this.convertFromToJSText = function (ftxt) {
    var jstxt = ''
    var re = /\?([^\?])/g
    jstxt = ftxt.replace(re, '$1')
    return jstxt
  }

  this.convertJSTextTo = function (jstxt) {
    var ftxt = ''
    var re = /([:\+\?'\@])/g
    ftxt = jstxt.replace(re, '?$&')
    return ftxt
  }

  this.Byte = function (data) {
    return new ByteVal(data)
  }

  this.getSaldo = function (seg, nr, hbci3Vers) {
    if (seg) {
      try {
        var base = seg.getEl(nr)
        var result = {
          'sollHaben': null,
          'buchungsdatum': null,
          'currency': null,
          'value': null
        }
        result.sollHaben = base.getEl(1) === 'C' ? 'H' : 'S'
        result.currency = hbci3Vers ? 'EUR' : base.getEl(3)
        result.value = parseFloat(base.getEl(2).replace(',', '.'))
        result.buchungsdatum = this.getJSDateFromSeg(base, hbci3Vers ? 3 : 4, hbci3Vers ? 4 : 5)
        return result
      } catch (ee) {
        return null
      }
    } else {
      return null
    }
  }

  this.getBetrag = function (seg, nr) {
    if (seg) {
      try {
        var base = seg.getEl(nr)
        var result = {
          'currency': null,
          'value': null
        }
        result.currency = base.getEl(2)
        result.value = parseFloat(base.getEl(1).replace(',', '.'))
        return result
      } catch (ee) {
        return null
      }
    } else {
      return null
    }
  }

  this.getJSDateFromSegTSP = function (seg, nr) {
    try {
      var base = seg.getEl(nr)
      return this.getJSDateFromSeg(base, 1, 2)
    } catch (e) {
      return null
    }
  }

  this.getJSDateFromSeg = function (seg, dateNr, timeNr) {
    if (seg) {
      try {
        var date = seg.getEl(dateNr)
        var time = '000000'
        try {
          if (timeNr) time = seg.getEl(timeNr)
        } catch (eee) {}
        var result = new Date()
        result.setTime(0)
        result.setYear(parseInt(date.substr(0, 4), 10))
        result.setMonth(parseInt(date.substr(4, 2), 10) - 1)
        result.setDate(parseInt(date.substr(6, 2), 10))
        result.setHours(parseInt(time.substr(0, 2), 10))
        result.setMinutes(parseInt(time.substr(2, 2), 10))
        result.setSeconds(parseInt(time.substr(4, 2), 10))
        return result
      } catch (ee) {
        return null
      }
    } else {
      return null
    }
  }

  this.escapeUserString = function (str) {
    // escapes special characters with a '?'
    // use this when forwarding user defined input (such as username/password) to a server
    //
    // SOURCE: http://linuxwiki.de/HBCI/F%C3%BCrEntwickler
    // TODO: find better/official source
    return str.replace(/[?+:]/g, '?$&')
  }
}()

var DatenElementGruppe = function () {
  var meDeg = this
  meDeg.nextEl = 0
  meDeg.data = []
  meDeg.desc = []

  meDeg.addDE = function (val) {
    meDeg.data[meDeg.nextEl] = val
    meDeg.desc[meDeg.nextEl] = 1
    meDeg.nextEl++
  }

  meDeg.addDEbin = function (val) {
    meDeg.data[meDeg.nextEl] = val
    meDeg.desc[meDeg.nextEl] = 3
    meDeg.nextEl++
  }

  meDeg.addDEG = function (grup) {
    meDeg.data[meDeg.nextEl] = grup
    meDeg.desc[meDeg.nextEl] = 2
    meDeg.nextEl++
  }

  meDeg.parse = function (parser) {
    var startPos
    var first = false
    while (!first || (parser.getCurrentChar() === ':' && parser.hasNext())) {
      if (!first) first = true
      else parser.nextPos()
      startPos = parser.getCurrentPos()
      parser.setMarkerWithCurrentPos('start')
      if (parser.getCurrentChar() === '@') {
        // binary
        parser.nextPos()
        parser.setMarkerWithCurrentPos('start')
        if (!parser.gotoNextValidChar('@')) throw new ParseError('Seg', 'Error binary!', startPos)
        var len = parseInt(parser.getTextFromMarkerToCurrentPos('start'), 10)
        parser.nextPos()
        parser.setMarkerWithCurrentPos('start')
        parser.setCurrentPos(parser.getCurrentPos() + len)
        if ("+:'".indexOf(parser.getCurrentChar()) === 1) throw new ParseError('Seg', 'Error binary, Wrong Length!' + len, startPos)
        meDeg.addDEbin(parser.getTextFromMarkerToCurrentPos('start'))
        parser.nextPos()
      } else if (parser.gotoNextValidCharButIgnoreWith("+:'", '?')) {
        // Normales datenelement
        meDeg.addDE(parser.getTextFromMarkerToCurrentPos('start'))
        // Datengruppe können nicht bestandteil einer datengruppe sein
      } else {
        throw new ParseError('Seg', 'Unerwartetes ENDE!', startPos)
      }
    }
  }

  meDeg.transformForSend = function () {
    var result = ''
    for (let i = 0; i !== meDeg.data.length; i++) {
      if (meDeg.data[i] !== NULL) {
        if (meDeg.desc[i] === 1) {
          result += (i !== 0 ? ':' : '') + meDeg.data[i] // DE
        } else if (meDeg.desc[i] === 2) { // kommt nicht vor
          result += (i !== 0 ? ':' : '') + meDeg.data[i].transformForSend() // DEG
        } else if (meDeg.desc[i] === 3) {
          result += (i !== 0 ? ':' : '') + '@' + meDeg.data[i].length + '@' + meDeg.data[i] // BIN DAT
        }
      } else {
        // leer
        result += (i !== 0 ? ':' : '')
      }
    }
    return result
  }

  meDeg.getEl = function (i) {
    return meDeg.data[i - 1]
  }
}

var Segment = function () {
  var meSeg = this
  meSeg.name = null
  meSeg.nr = 0
  meSeg.vers = 0
  meSeg.bez = 0
  meSeg.store = new DatenElementGruppe()

  meSeg.init = function (n, nr, ve, be) {
    meSeg.name = n
    meSeg.nr = nr
    meSeg.vers = ve
    meSeg.bez = be
  }

  meSeg.transformForSend = function () {
    var result = ''
    result += meSeg.name // Nr. 1 Segmentkennung an ..6 M 1
    result += ':' + meSeg.nr // Nr. 2 Segmentnummer num ..3 M 1 >=1
    result += ':' + meSeg.vers // Nr. 3 Segmentversion GD num ..3 M 1
    if (meSeg.bez !== 0) result += ':' + meSeg.bez
    for (let i = 0; i !== meSeg.store.data.length; i++) {
      if (meSeg.store.data[i] !== NULL) {
        if (meSeg.store.desc[i] === 1) {
          result += '+' + meSeg.store.data[i] // DE
        } else if (meSeg.store.desc[i] === 2) {
          result += '+' + meSeg.store.data[i].transformForSend() // DEG
        } else if (meSeg.store.desc[i] === 3) {
          result += '+@' + meSeg.store.data[i].length + '@' + meSeg.store.data[i] // BIN DAT
        }
      } else {
        // leer
        result += '+'
      }
    }
    result += "'"
    return result
  }

  meSeg.parse = function (parser) {
    var startPos = parser.getCurrentPos()
    // 1. Segmentkopf
    // Nr. 1 Segmentkennung an ..6 M 1
    parser.setMarkerWithCurrentPos('start')
    if (parser.gotoNextValidChar(':')) {
      meSeg.name = parser.getTextFromMarkerToCurrentPos('start')
    } else {
      throw new ParseError('Seg', 'Segmentkennung Fehlt!', startPos)
    }

    // Nr. 2 Segmentnummer num ..3 M 1 >=1
    parser.nextPos()
    startPos = parser.getCurrentPos()
    parser.setMarkerWithCurrentPos('start')
    if (parser.gotoNextValidChar(':')) {
      meSeg.nr = parser.getTextFromMarkerToCurrentPos('start')
    } else {
      throw new ParseError('Seg', 'Segmentnummer fehlt!', startPos)
    }

    // Nr. 3 Segmentversion GD num ..3 M 1
    parser.nextPos()
    startPos = parser.getCurrentPos()
    parser.setMarkerWithCurrentPos('start')
    if (parser.gotoNextValidChar(":+'")) {
      meSeg.vers = parser.getTextFromMarkerToCurrentPos('start')
    } else {
      throw new ParseError('Seg', 'Segmentversion fehlt!', startPos)
    }

    // Nr. 4 Bezugssegment GD num ..3 K 1 >=1
    if (parser.getCurrentChar() === ':') {
      parser.nextPos()
      startPos = parser.getCurrentPos()
      parser.setMarkerWithCurrentPos('start')
      if (parser.gotoNextValidChar('+')) {
        meSeg.bez = parser.getTextFromMarkerToCurrentPos('start')
      } else {
        throw new ParseError('Seg', 'Unerwartetes ENDE!', startPos)
      }
    }

    // jetzt kommen datenlemente oder datenelementgruppen
    while (parser.getCurrentChar() !== "'" && parser.hasNext()) {
      parser.nextPos()
      startPos = parser.getCurrentPos()
      parser.setMarkerWithCurrentPos('start')
      if (parser.getCurrentChar() === '@') {
        // binary
        parser.nextPos()
        parser.setMarkerWithCurrentPos('start')
        if (!parser.gotoNextValidChar('@')) throw new ParseError('Seg', 'Error binary!', startPos)
        var len = parseInt(parser.getTextFromMarkerToCurrentPos('start'), 10)
        parser.nextPos()
        parser.setMarkerWithCurrentPos('start')
        parser.setCurrentPos(parser.getCurrentPos() + len)
        if ("+:'".indexOf(parser.getCurrentChar()) === 1) throw new ParseError('Seg', 'Error binary, Wrong Length!' + len, startPos)
        meSeg.store.addDEbin(parser.getTextFromMarkerToCurrentPos('start'))
      } else if (parser.gotoNextValidCharButIgnoreWith("+:'", '?')) {
        if (parser.getCurrentChar() === '+' || parser.getCurrentChar() === "'") {
          // Normales datenelement
          meSeg.store.addDE(parser.getTextFromMarkerToCurrentPos('start'))
        } else {
          // Datengruppe
          parser.setPosBackToMarker('start')
          var neuDeg = new DatenElementGruppe()
          neuDeg.parse(parser)
          meSeg.store.addDEG(neuDeg)
        }
      } else {
        throw new ParseError('Seg', 'Unerwartetes ENDE!', startPos)
      }
    }
  }

  meSeg.getEl = function (nr) {
    return meSeg.store.data[nr - 1]
  }
}

var Nachricht = function (protoVersion) {
  var meMsg = this
  meMsg.segments = []
  meMsg.segmentsCtr = 0
  meMsg.signIt = null
  meMsg.hnvsk = null
  meMsg.msgNr = 0
  meMsg.protoVersion = protoVersion

  meMsg.sign = function (signObj) { // signObj = {'pin':pin,'tan':tan,'sysId':0}// Tan bitte null setzen wenn nicht benötigt
    meMsg.signIt = signObj
  }

  meMsg.init = function (dialogId, ongoingNr, blz, kundenId) {
    // this is called wenn es ein outgoing message ist
    meMsg.msgNr = ongoingNr
    var seg = new Segment()
    seg.init('HNHBK', 1, 3, 0)
    meMsg.addSeg(seg)
    seg.store.addDE(Helper.getNrWithLeadingNulls(0, 12)) // Länge
    seg.store.addDE(meMsg.protoVersion + '') // Version
    seg.store.addDE(dialogId) // DialogID, bei 0 beginnend wird von KI bekannt gegeben
    seg.store.addDE(meMsg.msgNr) // NachrichtenNr. streng monoton von 1 ab steigen
    if (meMsg.signIt) { // NUr für das Pin/Tan Verfahren 1 Schritt!
      // Infos hierzu: http://www.hbci-zka.de/dokumente/spezifikationDeutsch/fintsv3/FinTS3.0SecuritySicherheitsverfahrenHBCIRel20130718FinalVersion.pdf Punkt B5.1
      // http://www.hbci-zka.de/dokumente/spezifikationDeutsch/fintsv3/FinTS3.0SecuritySicherheitsverfahrenPINTANRel20101027FinalVersion.pdf B8.4
      // Sicherheitsprofil ["PIN",1] = PIN und 1 Schrittverfahren
      // Sicherheitsfunktion: 999  1 SChrittverfahren / 2Schritt siehe BPD
      // Sicherheitskontrollreferenz: 1 // Muss mit Signaturabschluss übereinstimmen
      // Bereich der Sicherheitsapplikation,kodiert: 1 // 1: Signaturkopf und HBCINutzdaten (SHM)
      // Rolle des Sicherheitslieferanten,kodiert: 1 // 1: Der Unterzeichner ist Herausgeber der signierten Nachricht, z.B. Erfasser oder Erstsignatur (ISS)
      // Sicherheitsidentifikation, Details: [1,null,0]
      //    Bezeichner Sicherheitspartei  1    1: Message Sender (MS), wenn ein Kunde etwas an sein Kreditinstitut sendet
      //    CID nur Chipkarte        null
      //     Id der Partei nur Software    0    Code, welcher die (Kommunikations)Partei identifiziert. Dieses Feld muss eine gültige, zuvor vom Banksystem angeforderte KundensystemID enthalten (analog zum RSAVerfahren). Dies gilt auch fürZweitUnd Drittsignaturen.
      //      beim Erstmal noch 0, dann auf Antwort von Bank in HISYN warten und das verwenden!
      //  Sicherheitsreferenznummer: 1 Verhinderung der Doppeleinreichung Bei softwarebasierten Verfahren wird die Sicherheitsreferenznummer auf Basis des DE KundensystemID und des DE Benutzerkennung der DEG Schlüsselnamen verwaltet.
      //              bei Pin/Tan kann das auch einfach bei 1 beibehalten werden :), sonst müsste man das aber eigtl. incrementieren
      //   Sicherheitsdatum und Uhrzeit [1,"20141210","003515"], 1: Bedeutung = Sicherheitszeitstempel (STS)
      //  Hashalgorithmus: [1,999,1]
      //    Verwendung des Hashalgorithmus,kodiert  1: Owner Hashing (OHA) (nur)
      //    Hashalgorithmus,kodiert          999: Gegenseitig vereinbart (ZZZ); hier: RIPEMD160 ( gibt noch andere Werte 16 vorallem SHAxxx
      //     Bezeichner für Hashalgorithmusparameter  1: IVC (Initialization value, clear text)
      //  Signaturalgorithmus: [6,10,16]
      //    Verwendung des Signaturalgorithmus, kodiert 6: Owner Signing (OSG)
      //    10: RSAAlgorithmus (bei RAH und RDH)
      //    Operationsmodus, kodiert  16:  ISO 97961 (bei RDH)
      //  Schlüsselname  [280,blz,kundenId,"S",0,0]
      //    Kreditinstitutskennung  280,blz
      //    Benutzerkennung     kundenId
      //    Schlüsselart      S  S: Signierschlüsse
      //    Schlüsselnummer      0
      //    Schlüsselversion    0
      var signatureId = (meMsg.signIt.sysId + '') === '0' ? 1 : meMsg.signIt.sigId
      meMsg.signIt.blz = blz
      meMsg.signIt.kundenId = kundenId

      // to be deleted - defined but never used: var segVers, secProfile
      if (meMsg.protoVersion === 300) {
        meMsg.signIt.server === undefined
          ? meMsg.addSeg(Helper.newSegFromArray('HNSHK', 4, [
            ['PIN', meMsg.signIt.pinVers === '999' ? 1 : 2], meMsg.signIt.pinVers, 1, 1, 1, [1, NULL, meMsg.signIt.sysId], signatureId, [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())],
            [1, 999, 1],
            [6, 10, 16],
            [280, blz, kundenId, 'S', 0, 0]
          ]))
          : meMsg.addSeg(Helper.newSegFromArray('HNSHK', 4, [
            ['PIN', meMsg.signIt.pinVers === '999' ? 1 : 2], meMsg.signIt.pinVers, 1, 1, 1, [2, NULL, meMsg.signIt.sysId], signatureId, [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())],
            [1, 999, 1],
            [6, 10, 16],
            [280, blz, kundenId, 'S', 0, 0]
          ]))
      } else {
        meMsg.signIt.server === undefined
          ? meMsg.addSeg(Helper.newSegFromArray('HNSHK', 3, [meMsg.signIt.pinVers, 1, 1, 1, [1, NULL, meMsg.signIt.sysId], signatureId, [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())],
            [1, 999, 1],
            [6, 10, 16],
            [280, blz, kundenId, 'S', 0, 0]
          ]))
          : meMsg.addSeg(Helper.newSegFromArray('HNSHK', 3, [meMsg.signIt.pinVers, 1, 1, 1, [2, NULL, meMsg.signIt.sysId], signatureId, [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())],
            [1, 999, 1],
            [6, 10, 16],
            [280, blz, kundenId, 'S', 0, 0]
          ]))
      }
    }
  }

  meMsg.parse = function (inTxt) {
    var parser = new Parser(inTxt)

    while (parser.hasNext()) {
      var segm = new Segment()
      segm.parse(parser)
      meMsg.segments.push(segm)
      parser.nextPos()
    }

    // prüfen ob verschlüsselt war
    if (meMsg.segments.length === 4 && meMsg.segments[1].name === 'HNVSK' && meMsg.segments[2].name === 'HNVSD') {
      var first = meMsg.segments[0]
      meMsg.hnvsk = meMsg.segments[1]
      var segHnvsd = meMsg.segments[2]
      var last = meMsg.segments[3]
      // Neue Segmente hinzufügen
      meMsg.segments = []
      meMsg.segments.push(first)
      if ((meMsg.hnvsk.vers === '3' && meMsg.hnvsk.getEl(1).getEl(1) === 'PIN') || (meMsg.hnvsk.vers === '2' && meMsg.hnvsk.getEl(1) === '998')) {
        var parser2 = new Parser(segHnvsd.getEl(1))
        while (parser2.hasNext()) {
          var segm2 = new Segment()
          segm2.parse(parser2)
          meMsg.segments.push(segm2)
          parser2.nextPos()
        }
      } else {
        throw new ParseError('Msg', 'Nicht unterstützte Verschlüsselungsmethode!', 0)
      }
      meMsg.segments.push(last)
    }
  }

  meMsg.transformForSend = function () {
    var top = meMsg.segments[0].transformForSend()
    var body = ''

    // Signatur abschluss
    if (meMsg.signIt) {
      // Signaturabschluss
      // Sicherheitskontrollreferenz 1 muss mit signaturkopf übereinstimmen
      // Validierungsresultat null, bleibt bei PinTan leer
      // Benutzerdefinierte Signatur [Pin,Tan], die Tan nur dann wenn durch den Geschäftsvorfall erforderlich
      if (meMsg.signIt.server === undefined) {
        if (meMsg.signIt.tan === NULL) {
          meMsg.addSeg(Helper.newSegFromArray('HNSHA', meMsg.protoVersion === 300 ? 2 : 1, [1, NULL, [meMsg.signIt.pin]]))
        } else {
          meMsg.addSeg(Helper.newSegFromArray('HNSHA', meMsg.protoVersion === 300 ? 2 : 1, [1, NULL, [meMsg.signIt.pin, meMsg.signIt.tan]]))
        }
      } else {
        meMsg.addSeg(Helper.newSegFromArray('HNSHA', 2, [2]))
      }
    }

    for (let i = 1; i !== meMsg.segments.length; i++) {
      body += meMsg.segments[i].transformForSend()
    }

    // Letztes segment erstellen
    if (meMsg.signIt) {
      // in body ist der eigentliche body der dann aber jetzt neu erstellt wird
      // Verschlüsselung
      // 1. HNVSK                                     HNVSK:998:3
      // Sicherheitsprofil                            [PIN:1]
      // Sicherheitsfunktion, kodiert                 998 // bleibt immer so unabhängig von der der tatsächlichen Funktion
      // Rolle des SicherheitsLieferanten, kodiert   1
      // Sicherheitsidentifikation, Details           [1.null.0]
      // Sicherheitsdatum und Uhrzeit                [1,20141216,205751]
      // VerschlüsselungsAlgorithmus                 [2,2,13,@8@,5,1]
      // Schlüsselname                                [280:12345678:max:V:0:0]
      //      Ctry Code                               280 (hier fest)
      //      BLZ
      //      benutzer
      //      Schlüsselart                            V Chiffrierschlüssel
      //      Schlüsselnummer                         0
      //      Schlüsselversion                        0
      // Komprimierungsfunktion                       0
      // Zertifikat                                   leer hier
      // +998+1+1::0+1:20141216:205751+2:2:13:@8@:5:1+280:12345678:max:V:0:0+0'
      if (meMsg.protoVersion === 300) {
        meMsg.hnvsk = Helper.newSegFromArray('HNVSK', 3, [
          ['PIN', meMsg.signIt.pinVers === '999' ? 1 : 2], 998, 1, [1, NULL, meMsg.signIt.sysId],
          [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())],
          [2, 2, 13, Helper.Byte('\0\0\0\0\0\0\0\0'), 5, 1],
          [280, meMsg.signIt.blz, meMsg.signIt.kundenId, 'V', 0, 0], 0
        ])
      } else {
        meMsg.hnvsk = Helper.newSegFromArray('HNVSK', 2, [998, 1, [1, NULL, meMsg.signIt.sysId],
          [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())],
          [2, 2, 13, Helper.Byte('\0\0\0\0\0\0\0\0'), 5, 1],
          [280, meMsg.signIt.blz, meMsg.signIt.kundenId, 'V', 0, 0], 0
        ])
      }
      meMsg.hnvsk.nr = 998
      var segHnvsd = Helper.newSegFromArray('HNVSD', 1, [Helper.Byte(body)])
      segHnvsd.nr = 999
      body = meMsg.hnvsk.transformForSend()
      body += segHnvsd.transformForSend()
    }

    // Abschließen
    var seg = Helper.newSegFromArray('HNHBS', 1, [meMsg.msgNr])
    meMsg.addSeg(seg)
    body += seg.transformForSend()
    var llength = top.length + body.length
    meMsg.segments[0].store.data[0] = Helper.getNrWithLeadingNulls(llength, 12)
    top = meMsg.segments[0].transformForSend()
    return top + body
  }

  meMsg.addSeg = function (seg) {
    seg.nr = meMsg.segmentsCtr + 1
    meMsg.segments[meMsg.segmentsCtr] = seg
    meMsg.segmentsCtr++
    return seg.nr
  }

  meMsg.isSigned = function () {
    return meMsg.selectSegByName('HNSHK').length === 1
  }

  meMsg.selectSegByName = function (name) {
    var r = []
    for (let i = 0; i !== meMsg.segments.length; i++) {
      if (meMsg.segments[i].name === name) {
        r.push(meMsg.segments[i])
      }
    }
    return r
  }

  meMsg.selectSegByBelongTo = function (belongTo) {
    var r = []
    for (let i = 0; i !== meMsg.segments.length; i++) {
      if (meMsg.segments[i].bez === (belongTo + '')) {
        r.push(meMsg.segments[i])
      }
    }
    return r
  }

  meMsg.selectSegByNameAndBelongTo = function (name, belongTo) {
    var r = []
    for (let i = 0; i !== meMsg.segments.length; i++) {
      if (meMsg.segments[i].name === name && meMsg.segments[i].bez === (belongTo + '')) {
        r.push(meMsg.segments[i])
      }
    }
    return r
  }

  // Nur für Debug/Entwicklungszwecke um ein JS Response aus einem echten Response zu generieren
  meMsg.createDebugJs = function () {
    var top = 'var sendMsg = new FinTSClient().testReturnMessageClass();\n\r'
    var sig = '\n\r'
    var body = ''

    for (let i = 0; i !== meMsg.segments.length; i++) {
      if (meMsg.segments[i].name === 'HNHBK' ||
          meMsg.segments[i].name === 'HNHBS' ||
          meMsg.segments[i].name === 'HNSHA') {
        // auslassen
      } else if (meMsg.segments[i].name === 'HNSHK') {
        // Signatur
        sig = "sendMsg.sign({'pin':'pin1234','tan':null,'sysId':'" + meMsg.segments[i].getEl(6).getEl(3) + "'});\n\r"
      } else {
        // generate array structure out of segment
        var segArray = []

        for (var a = 0; a !== meMsg.segments[i].store.data.length; a++) {
          if (meMsg.segments[i].store.desc[a] === 1) { // DE
            segArray.push(meMsg.segments[i].store.data[a])
          } else if (meMsg.segments[i].store.desc[a] === 2) { // DEG
            // DEG durchforsten
            var degArray = []

            for (var d = 0; d !== meMsg.segments[i].store.data[a].data.length; d++) {
              if (meMsg.segments[i].store.data[a].desc[d] === 1) { // DE
                degArray.push(meMsg.segments[i].store.data[a].data[d])
              } else if (meMsg.segments[i].store.data[a].desc[d] === 2) { // DEG
                // sollte hier garnicht auftreten
                throw new Error('FEHLER DEG erhalten wo dies nicht passieren sollte')
              } else if (meMsg.segments[i].store.desc[a].desc[d] === 3) { // BINARY
                degArray.push('BYTE' + meMsg.segments[i].store.data[a].data[d])
              }
            }

            segArray.push(degArray)
          } else if (meMsg.segments[i].store.desc[a] === 3) { // BINARY
            segArray.push('BYTE' + meMsg.segments[i].store.data[a])
          }
        }

        if (meMsg.segments[i].bez === 0) {
          body += "sendMsg.addSeg(Helper.newSegFromArray('" + meMsg.segments[i].name + "', " + meMsg.segments[i].vers + ', ' + JSON.stringify(segArray) + '));\n\r'
        } else {
          body += "sendMsg.addSeg(Helper.newSegFromArrayWithBez('" + meMsg.segments[i].name + "', " + meMsg.segments[i].vers + ',' + meMsg.segments[i].bez + ',' + JSON.stringify(segArray) + '));\n\r'
        }
      }
    }
    return top + sig + body
  }
}

var Exceptions = {}

Exceptions.OpenFinTSClientException = function () {
  Error.call(this) // super constructor
  Error.captureStackTrace(this, this.constructor)
}
util.inherits(Exceptions.OpenFinTSClientException, Error)
Exceptions.OpenFinTSClientException.prototype.toString = function () {
  return this.message ? this.message : 'OpenFinTSClientException'
}

Exceptions.GVNotSupportedByKI = function (type, avail) {
  Exceptions.OpenFinTSClientException.call(this)
  this.gvType = type
  this.spVers = avail ? [] : Object.keys(avail)
  this.message = 'There is no version of ' + this.gvType + ' which is supported by both, the client and the server.'
}
util.inherits(Exceptions.GVNotSupportedByKI, Exceptions.OpenFinTSClientException)

Exceptions.MalformedMessageFormat = function (msg) {
  Exceptions.OpenFinTSClientException.call(this)
  this.message = 'MalformedMessage: ' + msg
}
util.inherits(Exceptions.MalformedMessageFormat, Exceptions.OpenFinTSClientException)

Exceptions.OrderFailedException = function (msg) {
  Exceptions.OpenFinTSClientException.call(this)
  this.msgDetail = msg
  this.message = 'Failed to perform Order, got error Message from Server.:' + msg.getEl(3)
}
util.inherits(Exceptions.OrderFailedException, Exceptions.OpenFinTSClientException)

Exceptions.InternalError = function (msgTxt) {
  Exceptions.OpenFinTSClientException.call(this)
}
util.inherits(Exceptions.InternalError, Exceptions.OpenFinTSClientException)

Exceptions.GVFailedAtKI = function (msg) {
  Exceptions.OpenFinTSClientException.call(this)
  this.data = msg
  this.message = 'GVFailed because Msg: ' + this.data[0] + ' - ' + this.data[2]
}
util.inherits(Exceptions.GVFailedAtKI, Exceptions.OpenFinTSClientException)

Exceptions.ConnectionFailedException = function (hostname) {
  Exceptions.OpenFinTSClientException.call(this)
  this.host = hostname
  this.toString = function () {
    return 'Connection to ' + this.host + ' failed.'
  }
}
util.inherits(Exceptions.ConnectionFailedException, Exceptions.OpenFinTSClientException)

/* Exceptions.WrongUserOrPinError = function(){
    Exceptions.OpenFinTSClientException.call(this);
    this.toString = function(){
      return "Wrong user or wrong pin.";
    };
  };
  util.inherits(Exceptions.WrongUserOrPinError, Exceptions.OpenFinTSClientException); */

Exceptions.MissingBankConnectionDataException = function (blz) {
  Exceptions.OpenFinTSClientException.call(this)
  this.blz = blz
  this.toString = function () {
    return 'No connection Url in Bankenliste found to connect to blz: ' + this.blz + '.'
  }
}
util.inherits(Exceptions.MissingBankConnectionDataException, Exceptions.OpenFinTSClientException)

Exceptions.OutofSequenceMessageException = function () {
  Exceptions.OpenFinTSClientException.call(this)
  this.toString = function () {
    return 'You have to ensure that only one message at a time is send to the server, use libraries like async or promisses. You can send a new message as soon as the callback returns.'
  }
}
util.inherits(Exceptions.OutofSequenceMessageException, Exceptions.OpenFinTSClientException)
/*
  .msg({ type:"",
  kiType:"",
    sendMsg:{
    1:[],
    2:[],
    3:function(){}
    },
    recvMsg:{
    1:function(segVers,relatedRespSegments,releatedRespMsgs,recvMsg)
    2:
    },
    aufsetzpunktLoc:[]
  });
  .done(function(error,order,recvMsg){

  });
*/

// TODO implement TanVerfahren in Order
var Order = function (client) {
  var meOrder = this
  meOrder.client = client
  meOrder.error = null

  var intReqTan = false
  var intSendMsg = []
  var intGmsgList = []

  meOrder.requireTan = function () {
    intReqTan = true
  }

  meOrder.msg = function (inData) {
    // 0. check no error
    if (meOrder.error) {
      return false
    }
    // 1. check if we support one of the segment versions
    var actVers = 0
    if (inData.kiType in client.bpd.gvParameters) {
      var availVers = Object.keys(inData.sendMsg).sort(function (a, b) {
        return b - a
      })
      for (var i in availVers) {
        if (availVers[i] in client.bpd.gvParameters[inData.kiType]) {
          actVers = availVers[i]
          break
        }
      }
    }
    if (actVers === 0) {
      meOrder.error = new Exceptions.GVNotSupportedByKI(inData.kiType, client.bpd.gvParameters[inData.kiType])
      return false
    }
    // 2. Find the appropriate action
    var act = null
    if (typeof inData.recvMsg === 'function') {
      act = inData.recvMsg
    } else if (actVers in inData.recvMsg) {
      act = inData.recvMsg[actVers]
    } else if (0 in inData.recvMsg) {
      act = inData.recvMsg[0]
    } else {
      act = function () {}
    }
    // 3. Prepare the Send Message object
    intSendMsg.push({
      version: actVers,
      segment: Helper.newSegFromArray(inData.type, actVers, inData.sendMsg[actVers]),
      action: act,
      aufsetzpunkt: null,
      aufsetzpunktLoc: (inData.aufsetzpunktLoc ? inData.aufsetzpunktLoc : []),
      finished: false,
      collectedSegments: [],
      collectedMessages: []
    })
  }

  meOrder.done = function (cb) {
    // Exit CB is called when the function returns here it is checked if an error occures and then disconnects
    var exitCb = function (error, order, recvMsg) {
      if (error) {
        meOrder.client.MsgEndDialog(function (error2, recvMsg2) {
          if (error2) {
            meOrder.client.log.con.error({
              error: error2
            }, 'Connection close failed after error.')
          } else {
            meOrder.client.log.con.debug('Connection closed okay, after error.')
          }
        })
      }
      cb(error, order, recvMsg)
    }
    // Main Part
    if (meOrder.error) {
      exitCb(meOrder.error, meOrder, null)
    } else {
      // Message prepare
      var perform = function () {
        var msg = new Nachricht(meOrder.client.protoVersion)
        msg.sign({
          'pin': meOrder.client.pin,
          'tan': NULL,
          'sysId': meOrder.client.sysId,
          'pinVers': meOrder.client.upd.availibleTanVerfahren[0],
          'sigId': meOrder.client.getNewSigId()
        })
        msg.init(meOrder.client.dialogId, meOrder.client.nextMsgNr, meOrder.client.blz, meOrder.client.kundenId)
        meOrder.client.nextMsgNr++
        // Fill in Segments

        for (var j in intSendMsg) {
          if (!intSendMsg[j].finished) {
            // 1. Resolve Aufsetzpunkt if required, TODO here diferntiate between versions
            if (intSendMsg[j].aufsetzpunkt) {
              if (intSendMsg[j].aufsetzpunktLoc.length >= 1) {
                for (; intSendMsg[j].segment.store.data.length < intSendMsg[j].aufsetzpunktLoc[0];) {
                  intSendMsg[j].segment.store.addDE(NULL)
                }
                if (intSendMsg[j].aufsetzpunktLoc.length <= 1) {
                  // direkt
                  intSendMsg[j].segment.store.data[intSendMsg[j].aufsetzpunktLoc[0] - 1] = intSendMsg[j].aufsetzpunkt
                } else {
                  // Unter DEG
                  exitCb(new Exceptions.InternalError('Aufsetzpunkt Location is in DEG not supported yet.'), meOrder, null)
                  return
                }
              } else {
                exitCb(new Exceptions.InternalError('Aufsetzpunkt Location is not set but an aufsetzpunkt was delivered'), meOrder, null)
                return
              }
            }
            // 2. Add Segment
            msg.addSeg(intSendMsg[j].segment)
          }
        }
        // Send Segments to Destination
        meOrder.client.SendMsgToDestination(msg, function (error, recvMsg) {
          if (error) {
            exitCb(error, meOrder, null)
          } else {
            var gotAufsetzpunkt = false
            // 1. global Message testen
            var gmsgException = null
            try {
              var HIRMG = recvMsg.selectSegByName('HIRMG')[0]
              for (let i in HIRMG.store.data) {
                intGmsgList.push(HIRMG.store.data[i].data)
                if (gmsgException === null && HIRMG.store.data[i].data[0].charAt(0) === '9') {
                  gmsgException = new Exceptions.OrderFailedException(HIRMG.store.data[i].data)
                }
              }
            } catch (ee) {
              exitCb(new Exceptions.MalformedMessageFormat('HIRMG is mandatory but missing.'), meOrder, recvMsg)
              return
            };
            if (gmsgException !== null) {
              exitCb(gmsgException, meOrder, recvMsg)
              return
            }
            // 2. einzelne Resp Segmente durchgehen
            try {
              for (let j in intSendMsg) {
                var relatedSegments = recvMsg.selectSegByBelongTo(intSendMsg[j].segment.nr)
                intSendMsg[j].finished = true
                for (let i in relatedSegments) {
                  if (relatedSegments[i].name === 'HIRMS') {
                    var HIRMS = relatedSegments[i]
                    for (var a in HIRMS.store.data) {
                      intSendMsg[j].collectedMessages.push(HIRMS.store.data[a].data)
                      if (HIRMS.store.data[a].data[0] === '3040') {
                        // Got an Aufsetzpunkt
                        try {
                          intSendMsg[j].aufsetzpunkt = HIRMS.store.data[a].data[3]
                        } catch (eee) {
                          intSendMsg[j].aufsetzpunkt = null
                        };
                        intSendMsg[j].finished = false
                        gotAufsetzpunkt = true
                      }
                    }
                  } else {
                    intSendMsg[j].collectedSegments.push(relatedSegments[i])
                  }
                }
              }
            } catch (ee) {
              exitCb(new Exceptions.InternalError('Failed parsing Segments'), meOrder, recvMsg)
            };
            // 3. check if we had an aufsetzpunkt
            if (gotAufsetzpunkt) {
              perform()
            } else {
              // 4. Fertig die callbacks rufen
              for (let j in intSendMsg) {
                intSendMsg[j].action(intSendMsg[j].version, intSendMsg[j].collectedSegments, intSendMsg[j].collectedMessages, recvMsg)
              }
              exitCb(null, meOrder, recvMsg)
            }
          }
        })
      }
      perform()
    }
  }

  meOrder.checkMessagesOkay = function (messages, throwWhenError) {
    for (let i in messages) {
      var type = messages[i][0].charAt(0)
      if (type === '9') {
        if (throwWhenError) {
          Exceptions.GVFailedAtKI(messages[i])
        }
        return false
      }
    }
    return true
  }

  meOrder.getSegByName = function (list, name) {
    for (var i in list) {
      if (list[i].name === name) {
        return list[i]
      }
    }
    return null
  }

  meOrder.getElFromSeg = function (seg, nr, defaultV) {
    if (seg) {
      var e = null
      try {
        e = seg.getEl(nr)
      } catch (e2) {
        e = defaultV
      }
      return e
    } else {
      return defaultV
    }
  }

  meOrder.checkKITypeAvailible = function (kiType, vers, returnParam) {
    if (kiType in meOrder.client.bpd.gvParameters) {
      var pReturn = {}
      var testVers = []

      if (vers instanceof Array) {
        testVers = testVers.concat(vers)
      } else {
        testVers.push(vers)
      }

      for (var vindex in testVers) {
        if (testVers[vindex] in meOrder.client.bpd.gvParameters[kiType]) {
          if (returnParam) {
            pReturn[vindex] = meOrder.client.bpd.gvParameters[kiType][testVers[vindex]]
          } else {
            return true
          }
        }
      }

      if (returnParam) {
        return pReturn
      } else {
        return false
      }
    } else {
      if (returnParam) {
        return {}
      } else {
        return false
      }
    }
  }
}

function OrderHelperChain () {
  this.returner = {}
};

OrderHelperChain.prototype.vers = function (v, cb) {
  if (v instanceof Array) {
    for (var i in v) {
      this.returner[v[i]] = cb
    }
  } else if (v) {
    this.returner[v] = cb
  } else {
    throw new Error('Development Error ' + v + ' not defined')
  }
  return this
}

OrderHelperChain.prototype.done = function () {
  return this.returner
}

Order.prototype.Helper = function () {
  return new OrderHelperChain()
}

var beautifyBPD = function (bpd) {
  var cbpd = bpd.clone()
  cbpd.gvParameters = '...'
  return cbpd
}

module.exports = {}
module.exports.Helper = Helper
module.exports.Nachricht = Nachricht
module.exports.Segment = Segment
module.exports.DatenElementGruppe = DatenElementGruppe
module.exports.Konto = Konto
module.exports.ByteVal = ByteVal
module.exports.NULL = NULL
module.exports.beautifyBPD = beautifyBPD
module.exports.Order = Order
module.exports.Exceptions = Exceptions
