//    monkeycoin.js - Generating the complete works of Shakespeare as aesthetic
//                    proof of work.
//    Copyright (C) 2014  Rhea Myers <rhea@myers.studio>
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.

////////////////////////////////////////////////////////////////////////////////
// Configuration
////////////////////////////////////////////////////////////////////////////////

var hash_length = 256;

// The first few lines of the First Folio after dedications & credits
// http://www.gutenberg.org/ebooks/2270

var first_folio = "The Tempest\
\
Actus primus, Scena prima.\
\
A tempestuous noise of Thunder and Lightning heard: Enter a Ship-master, and a Boteswaine.\
\
Master. Bote-swaine.\
\
Botes. Heere Master: What cheere?\
\
Mast. Good: Speake to th' Mariners: fall too't, yarely, or we run our selues a ground, bestirre, bestirre."

////////////////////////////////////////////////////////////////////////////////
// Globals
////////////////////////////////////////////////////////////////////////////////

// Should encapsulate

var ui;
var matched;
var tries;
var hash;
var digest;
var works;
var difficulty = 1;
var previousDigest = "";

////////////////////////////////////////////////////////////////////////////////
// Utility code
////////////////////////////////////////////////////////////////////////////////

// Request the next animation frame on any platform version

window.requestAnimFrame = (function () {
                             return window.requestAnimationFrame  ||
                               window.webkitRequestAnimationFrame ||
                               window.mozRequestAnimationFrame    ||
                               function( callback ){
                                 window.setTimeout(callback, 1000 / 60);
                               };
                           })();

////////////////////////////////////////////////////////////////////////////////
// Create UI for each block
////////////////////////////////////////////////////////////////////////////////

var createSection = function (where) {
  var block = document.createElement("div");
  $(block).addClass("block");
  var works = document.createElement("p");
  var caption = document.createElement("p");
  $(caption).css("word-wrap", "break-word");
  $(block).append(works);
  $(block).append(caption);
  $(where).append(block);
  return {block: block, works: works, caption: caption};
};

////////////////////////////////////////////////////////////////////////////////
// The digest
////////////////////////////////////////////////////////////////////////////////

var newHash = function () {
  return sjcl.hash.sha256.hash(previousDigest + tries);
}

var describeDigest = function (hash) {
  var digest = sjcl.codec.hex.fromBits(hash);
  // Ensure the first and subsequent layouts line up
  var prev = previousDigest ? previousDigest : "None" ;
  ui.caption.innerHTML = "<b>Nonce:</b>&nbsp;" + tries +
    "<br /><b>SHA&#8209;256:</b>&nbsp;" + digest +
    "<br / ><b>Previous&nbsp;Digest:</b>&nbsp;" + prev;
  return digest;
};

var hashToText = function (hash) {
  var text = "";
  var len = hash_length / 8, i, tmp;
  for (i= 0 ; i < len; i++) {
    if ((i&3) === 0) {
      tmp = hash[i/4];
    }
    text += String.fromCharCode(tmp >>> 24);
    tmp <<= 8;
  }
  return text;
}

var describeText = function (hash) {
  var works = hashToText(hash);
  ui.works.innerHTML = "<h2>" + works + "</h2>";
  return works;
}

////////////////////////////////////////////////////////////////////////////////
// Detecting the works of Shakespeare in the digest
////////////////////////////////////////////////////////////////////////////////

var detectWorks = function (works, difficulty) {
  return works.substring(0, difficulty) == first_folio.substring(0, difficulty);
};

var styleMatch = function (ui, difficulty) {
  var works = $(ui.works).find('h2')[0]
  var text = works.innerHTML;
  var matched = text.substring(0, difficulty);
  var unmatched = text.substring(difficulty);
  works.innerHTML = "<span style=\"color:red\">" +
    matched + "</span>" + unmatched;
}

////////////////////////////////////////////////////////////////////////////////
// Main flow of execution
////////////////////////////////////////////////////////////////////////////////

var nextBlock = function () {
  // Set up the state for the new block
  matched = false;
  tries = 0;
  // Create the ui section for the new block
  ui = createSection("#blocks");
  $('html, body').animate({scrollTop: $(document).height()}, 'slow');
  // And do the work
  animationLoop();
};

var animationLoop = function () {
  if (! matched) {
    requestAnimFrame(animationLoop);
    hash = newHash();
    digest = describeDigest(hash);
    works = describeText(hash);
    matched = detectWorks(works, difficulty);
    tries = tries + 1;
  } else {
    styleMatch(ui, difficulty);
    difficulty += 1;
    previousDigest = digest;
    nextBlock();
  }
};
