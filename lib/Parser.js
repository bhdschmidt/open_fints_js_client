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
var ParseError = function (area, txt, pos) {
  this.t = txt
  this.toString = function () {
    return this.t
  }
}

var Parser = function (inTxt) {
  var me = this

  me.data = inTxt
  me.curPos = 0
  me.marker = {}

  me.clearMarker = function () {
    me.marker = {}
  }

  me.setMarker = function (mark, pos) {
    me.marker[mark] = pos
  }

  me.setMarkerWithCurrentPos = function (mark) {
    me.setMarker(mark, me.curPos)
  }

  me.setPosBackToMarker = function (mark) {
    me.curPos = me.marker[mark]
  }

  me.getCurrentPos = function () {
    return this.curPos
  }

  me.setCurrentPos = function (pos) {
    me.curPos = pos
  }

  me.getCurrentChar = function () {
    return me.data[me.curPos]
  }

  me.hasNext = function () {
    if (me.curPos < me.data.length) {
      return true
    } else {
      return false
    }
  }

  me.nextPos = function () {
    if (me.curPos < me.data.length) {
      me.curPos++
      return true
    } else {
      return false
    }
  }

  me.getTextFromMarkerToCurrentPos = function (mark) {
    return me.getTextFromPostoPos(me.marker[mark], me.curPos)
  }

  me.getTextFromPostoPos = function (pos1, pos2) {
    return me.data.substr(pos1, pos2 - pos1)
  }

  me.findNextValidChar = function (validChars) {
    let i = 0
    for (i = me.curPos; i < me.data.length; i++) {
      if (validChars.indexOf(me.data[i]) !== -1) {
        return i
      }
    }
    return -1
  }

  me.gotoNextValidChar = function (validChars) {
    var pos = me.findNextValidChar(validChars)
    if (pos === -1) {
      me.curPos = me.data.length
      return false
    } else {
      me.curPos = pos
      return true
    }
  }

  // This goes to the first char of the string
  me.findNextValidString = function (arrayOfString) {
    var origPos = me.curPos
    var validChars = ''

    for (let i = 0; i !== arrayOfString.length; i++) {
      validChars += arrayOfString[i].charAt(0)
    }

    var pos = me.curPos
    do {
      pos = me.findNextValidChar(validChars)
      if (pos !== -1) {
        for (let i = 0; i !== arrayOfString.length; i++) {
          if (arrayOfString[i].charAt(0) === me.data[pos]) {
            // prüfen ob voll passt
            var compStr = me.data.substr(pos, arrayOfString[i].length)
            if (compStr === arrayOfString[i]) {
              // fertig
              me.curPos = origPos
              return pos
            }
          }
        }
        me.curPos = pos + 1
      }
    } while (pos !== -1)

    me.curPos = origPos
    return pos
  }

  me.gotoNextValidString = function (arrayOfString) {
    var pos = me.findNextValidString(arrayOfString)
    if (pos === -1) {
      me.curPos = me.data.length
      return false
    } else {
      me.curPos = pos
      return true
    }
  }

  me.gotoNextValidCharButIgnoreWith = function (validChars, demask) {
    while (true) {
      var pos = me.findNextValidChar(validChars)
      if (pos === -1) {
        me.curPos = me.data.length
        return false
      } else if (pos === 0) {
        me.curPos = pos
        return true
      } else if (demask.indexOf(me.data[pos - 1]) !== -1) {
        if ((pos + 1) < me.data.length) {
          me.curPos = pos + 1
          // retry
        } else {
          me.curPos = pos
          return false
        }
      } else {
        me.curPos = pos
        return true
      }
    }
  }
}

module.exports = {}
module.exports.Parser = Parser
module.exports.ParseError = ParseError
