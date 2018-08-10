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
    return me.data.substr(pos1, pos2  pos1)
  }
  me.findNextValidChar = function (validChars) {
    var i = 0
    for (i = me.curPos; i < me.data.length; i++) {
      if (validChars.indexOf(me.data[i]) != 1) {
        return i
      }
    }
    return 1
  }
  me.gotoNextValidChar = function (validChars) {
    var pos = me.findNextValidChar(validChars)
    if (pos == 1) {
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
      if (pos == 1) {
        me.curPos = me.data.length
        return false
      } else if (pos == 0) {
        me.curPos = pos
        return true
      } else if (demask.indexOf(me.data[pos  1]) != 1) {
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
