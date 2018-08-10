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
      for (var i = 0; i != array.length; i++) {
        for (var a = 0; a != array[i].store.data.length; a++) {
          var d = array[i].store.data[a]
          if (d.getEl(1) == id) {
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
    var neu = len  stxt.length
    for (var i = 0; i != neu; i++) {
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
    for (var i = 0; i != ar.length; i++) {
      if (ar[i] instanceof Array) {
        var neu = new DatenElementGruppe()
        for (var j = 0; j != ar[i].length; j++) {
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
      for (var i = 0; i != deOrDeg.data.length; i++) {
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
}()

var DatenElementGruppe = function () {
  var meDeg = this
  meDeg.nextEl = 0
  meDeg.data = new Array()
  meDeg.desc = new Array()
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
    while (!first || (parser.getCurrentChar() == ':' && parser.hasNext())) {
      if (!first) first = true
      else parser.nextPos()
      startPos = parser.getCurrentPos()
      parser.setMarkerWithCurrentPos('start')
      if (parser.getCurrentChar() == '@') {
        // binary
        parser.nextPos()
        parser.setMarkerWithCurrentPos('start')
        if (!parser.gotoNextValidChar('@')) throw new ParseError('Seg', 'Error binary!', startPos)
        var len = parseInt(parser.getTextFromMarkerToCurrentPos('start'))
        parser.nextPos()
        parser.setMarkerWithCurrentPos('start')
        parser.setCurrentPos(parser.getCurrentPos() + len)
        if ("+:'".indexOf(parser.getCurrentChar()) == 1) throw new ParseError('Seg', 'Error binary, Wrong Length!' + len, startPos)
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
    for (var i = 0; i != meDeg.data.length; i++) {
      if (meDeg.data[i] != NULL) {
        if (meDeg.desc[i] == 1) {
          result += (i != 0 ? ':' : '') + meDeg.data[i] // DE
        } else if (meDeg.desc[i] == 2) { // kommt nicht vor
          result += (i != 0 ? ':' : '') + meDeg.data[i].transformForSend() // DEG
        } else if (meDeg.desc[i] == 3) {
          result += (i != 0 ? ':' : '') + '@' + meDeg.data[i].length + '@' + meDeg.data[i] // BIN DAT
        }
      } else {
        // leer
        result += (i != 0 ? ':' : '')
      }
    }
    return result
  }
  meDeg.getEl = function (i) {
    return meDeg.data[i  1]
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
    for (var i = 0; i != meSeg.store.data.length; i++) {
      if (meSeg.store.data[i] != NULL) {
        if (meSeg.store.desc[i] == 1) {
          result += '+' + meSeg.store.data[i] // DE
        } else if (meSeg.store.desc[i] == 2) {
          result += '+' + meSeg.store.data[i].transformForSend() // DEG
        } else if (meSeg.store.desc[i] == 3) {
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
    if (parser.getCurrentChar() == ':') {
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
    while (parser.getCurrentChar() != "'" && parser.hasNext()) {
      parser.nextPos()
      startPos = parser.getCurrentPos()
      parser.setMarkerWithCurrentPos('start')
      if (parser.getCurrentChar() == '@') {
        // binary
        parser.nextPos()
        parser.setMarkerWithCurrentPos('start')
        if (!parser.gotoNextValidChar('@')) throw new ParseError('Seg', 'Error binary!', startPos)
        var len = parseInt(parser.getTextFromMarkerToCurrentPos('start'))
        parser.nextPos()
        parser.setMarkerWithCurrentPos('start')
        parser.setCurrentPos(parser.getCurrentPos() + len)
        if ("+:'".indexOf(parser.getCurrentChar()) == 1) throw new ParseError('Seg', 'Error binary, Wrong Length!' + len, startPos)
        meSeg.store.addDEbin(parser.getTextFromMarkerToCurrentPos('start'))
      } else if (parser.gotoNextValidCharButIgnoreWith("+:'", '?')) {
        if (parser.getCurrentChar() == '+' || parser.getCurrentChar() == "'") {
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
    return meSeg.store.data[nr  1]
  }
}

var Nachricht = function () {
  var meMsg = this
  meMsg.segments = new Array()
  meMsg.segmentsCtr = 0
  meMsg.signIt = null
  meMsg.hnvsk = null
  meMsg.msgNr = 0

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
    seg.store.addDE('300') // Version
    seg.store.addDE(dialogId) // DialogID, bei 0 beginnend wird von KI bekannt gegeben
    seg.store.addDE(meMsg.msgNr) // NachrichtenNr. streng monoton von 1 ab steigen
    if (meMsg.signIt) { // NUr für das Pin/Tan Verfahren 1 Schritt!
      // Infos hierzu: http://www.hbciZka.de/dokumente/spezifikationDeutsch/fintsv3/FinTS3.0SecuritySicherheitsverfahrenHBCIRel20130718FinalVersion.pdf Punkt B5.1
      // http://www.hbciZka.de/dokumente/spezifikationDeutsch/fintsv3/FinTS3.0SecuritySicherheitsverfahrenPINTANRel20101027FinalVersion.pdf B8.4
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
      var signatureId = (meMsg.signIt.sysId + '') == '0' ? 1 : meMsg.signIt.sigId
      meMsg.signIt.blz = blz
      meMsg.signIt.kundenId = kundenId
      meMsg.signIt.server === undefined
        ? meMsg.addSeg(Helper.newSegFromArray('HNSHK', 4, [['PIN', meMsg.signIt.pinVers == '999' ? 1 : 2], meMsg.signIt.pinVers, 1, 1, 1, [1, NULL, meMsg.signIt.sysId], signatureId, [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())], [1, 999, 1], [6, 10, 16], [280, blz, kundenId, 'S', 0, 0]]))
        : meMsg.addSeg(Helper.newSegFromArray('HNSHK', 4, [['PIN', meMsg.signIt.pinVers == '999' ? 1 : 2], meMsg.signIt.pinVers, 1, 1, 1, [2, NULL, meMsg.signIt.sysId], signatureId, [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())], [1, 999, 1], [6, 10, 16], [280, blz, kundenId, 'S', 0, 0]]))
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
    if (meMsg.segments.length == 4 && meMsg.segments[1].name == 'HNVSK' && meMsg.segments[2].name == 'HNVSD') {
      var first = meMsg.segments[0]
      meMsg.hnvsk = meMsg.segments[1]
      var segHnvsd = meMsg.segments[2]
      var last = meMsg.segments[3]
      // Neue Segmente hinzufügen
      meMsg.segments = new Array()
      meMsg.segments.push(first)
      if (meMsg.hnvsk.getEl(1).getEl(1) == 'PIN') {
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
          meMsg.addSeg(Helper.newSegFromArray('HNSHA', 2, [1, NULL, [meMsg.signIt.pin]]))
        } else {
          meMsg.addSeg(Helper.newSegFromArray('HNSHA', 2, [1, NULL, [meMsg.signIt.pin, meMsg.signIt.tan]]))
        }
      } else {
        meMsg.addSeg(Helper.newSegFromArray('HNSHA', 2, [2]))
      }
    }
    for (var i = 1; i != meMsg.segments.length; i++) {
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
      meMsg.hnvsk = Helper.newSegFromArray('HNVSK', 3, [['PIN', meMsg.signIt.pinVers == '999' ? 1 : 2], 998, 1, [1, NULL, meMsg.signIt.sysId], [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())], [2, 2, 13, Helper.Byte('\0\0\0\0\0\0\0\0'), 5, 1], [280, meMsg.signIt.blz, meMsg.signIt.kundenId, 'V', 0, 0], 0])
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
    return meMsg.selectSegByName('HNSHK').length == 1
  }

  meMsg.selectSegByName = function (name) {
    var r = []
    for (var i = 0; i != meMsg.segments.length; i++) {
      if (meMsg.segments[i].name == name) {
        r.push(meMsg.segments[i])
      }
    }
    return r
  }
  meMsg.selectSegByBelongTo = function (belongTo) {
    var r = []
    for (var i = 0; i != meMsg.segments.length; i++) {
      if (meMsg.segments[i].bez == (belongTo + '')) {
        r.push(meMsg.segments[i])
      }
    }
    return r
  }
  meMsg.selectSegByNameAndBelongTo = function (name, belongTo) {
    var r = []
    for (var i = 0; i != meMsg.segments.length; i++) {
      if (meMsg.segments[i].name == name && meMsg.segments[i].bez == (belongTo + '')) {
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
    for (var i = 0; i != meMsg.segments.length; i++) {
      if (meMsg.segments[i].name == 'HNHBK' ||
           meMsg.segments[i].name == 'HNHBS' ||
           meMsg.segments[i].name == 'HNSHA') {
        // auslassen
      } else if (meMsg.segments[i].name == 'HNSHK') {
        // Signatur
        sig = "sendMsg.sign({'pin':'pin1234','tan':null,'sysId':'" + meMsg.segments[i].getEl(6).getEl(3) + "'});\n\r"
      } else {
        // generate array structure out of segment
        var segArray = new Array()
        for (var a = 0; a != meMsg.segments[i].store.data.length; a++) {
          if (meMsg.segments[i].store.desc[a] == 1) { // DE
            segArray.push(meMsg.segments[i].store.data[a])
          } else if (meMsg.segments[i].store.desc[a] == 2) { // DEG
            // DEG durchforsten
            var degArray = new Array()
            for (var d = 0; d != meMsg.segments[i].store.data[a].data.length; d++) {
              if (meMsg.segments[i].store.data[a].desc[d] == 1) { // DE
                degArray.push(meMsg.segments[i].store.data[a].data[d])
              } else if (meMsg.segments[i].store.data[a].desc[d] == 2) { // DEG
                // sollte hier garnicht auftreten
                throw 'FEHLER DEG erhalten wo dies nicht passieren sollte'
              } else if (meMsg.segments[i].store.desc[a].desc[d] == 3) { // BINARY
                degArray.push('BYTE' + meMsg.segments[i].store.data[a].data[d])
              }
            }
            segArray.push(degArray)
          } else if (meMsg.segments[i].store.desc[a] == 3) { // BINARY
            segArray.push('BYTE' + meMsg.segments[i].store.data[a])
          }
        }
        if (meMsg.segments[i].bez == 0) { body += "sendMsg.addSeg(Helper.newSegFromArray('" + meMsg.segments[i].name + "', " + meMsg.segments[i].vers + ', ' + JSON.stringify(segArray) + '));\n\r' } else { body += "sendMsg.addSeg(Helper.newSegFromArrayWithBez('" + meMsg.segments[i].name + "', " + meMsg.segments[i].vers + ',' + meMsg.segments[i].bez + ',' + JSON.stringify(segArray) + '));\n\r' }
      }
    }
    return top + sig + body
  }
}

module.exports = {}
module.exports.Helper = Helper
module.exports.Nachricht = Nachricht
module.exports.Segment = Segment
module.exports.DatenElementGruppe = DatenElementGruppe
module.exports.Konto = Konto
module.exports.ByteVal = ByteVal
module.exports.NULL = NULL
