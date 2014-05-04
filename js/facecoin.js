//    facecoin.js - Face recognition in hash bitmaps as aesthetic proof of work.
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

var digest_size = 64;
var bit_depth = 8; //1;
var bitmap_size = 8; //16;
var canvas_size = 256;
var canvas_scale = canvas_size / bitmap_size;
var blur_radius = 5;
var match_line_width = 2;
var extra_text_height = 234;
var truncate_blocks_at = 128;

////////////////////////////////////////////////////////////////////////////////
// Globals
////////////////////////////////////////////////////////////////////////////////

// Should encapsulate

var ui;
var matches;
var tries;
var digest;
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
  var figure = document.createElement("span");
  $(figure).addClass("page-grid-cell");
  $(figure).width(canvas_size);
  // This is so the first cell isn't shorter than the others
  $(figure).height(canvas_size + extra_text_height);
  var canvas = document.createElement("canvas");
  canvas.width = canvas_size;
  canvas.height = canvas_size;
  var caption = document.createElement("p");
  $(caption).css("word-wrap", "break-word");
  $(caption).width(canvas_size)
  $(figure).append(canvas);
  $(figure).append(caption);
  $(where).append(figure);
  return {figure: figure, canvas: canvas, caption: caption,
          ctx: canvas.getContext('2d')};
};

////////////////////////////////////////////////////////////////////////////////
// The digest
////////////////////////////////////////////////////////////////////////////////

var newDigest = function () {
  var hash = sjcl.hash.sha256.hash(previousDigest + tries);
  var digest = sjcl.codec.hex.fromBits(hash);
  // Ensure the first and subsequent layouts line up
  prev = previousDigest ? previousDigest : "None<br /><br />" ;
  ui.caption.innerHTML = "<b>Previous&nbsp;Digest:</b>&nbsp;" + prev +
    "&nbsp;<br /><b>Nonce:</b>&nbsp;" + tries +
    "<br /><b>SHA&#8209;256:</b>&nbsp;" + digest;
  return digest;
};

////////////////////////////////////////////////////////////////////////////////
// Drawing the digest as a bitmap
////////////////////////////////////////////////////////////////////////////////

/*
var imageBuffer = document.createElement('canvas');
imageBuffer.width = 8;
imageBuffer.height = 8;
var bufferCtx = imageBuffer.getContext('2d');
var bufferImg = new Image();
var faceToImage = function (digest) {
  for(var y = 0; y < 8; y++) {
    for (var x = 0; x < 8; x++) {
      var index = x + (y * 8);
      // Treat each byte as a grey value
      var grey = parseInt(digest[index], 16) * 16;
      // Slower than other alternatives, but clear
      bufferCtx.fillStyle = "rgb(" + grey +"," + grey + "," + grey
                          + ")";
                   bufferCtx.fillRect(x, y, 1, 1);
    }
  }
  bufferImg.src = imageBuffer.toDataURL();
  return bufferImg
};

var drawFace = function (ui, digest) {
  var img = faceToImage(digest);
  ui.ctx.drawImage(img, 0, 0, 256, 256);
};

*/

var pixelValue8Bit = function(x, y, bitmap_width, digest) {
  var index = x + (y * bitmap_width);
  var grey = parseInt(digest[index], 16) * 16;
  return grey;
};

var pixelValue1Bit = function(x, y, bitmap_width, digest) {
  var byte_index = Math.floor((x + (y * bitmap_width)) / 4);
  var bit_index = (x + (y * bitmap_width)) % 4;
  var grey = ((parseInt(digest[byte_index], 16) >> bit_index) & 0x01) * 255;
  return grey;
};

var pixelValue = pixelValue8Bit;

// Ideally we'd just upscale and tween pixel values, but this looks better

var drawFace = function (ui, digest) {
   for(var y = 0; y < bitmap_size; y++) {
    for (var x = 0; x < bitmap_size; x++) {
      var grey = pixelValue(x, y, bitmap_size, digest);
      // Slower than other alternatives, but clear
      ui.ctx.fillStyle = "rgb(" + grey +"," + grey + "," + grey + ")";
      ui.ctx.fillRect(x * canvas_scale, y * canvas_scale,
                      canvas_scale, canvas_scale);
    }
  }
  stackBlurCanvasRGB(ui.ctx, 0, 0, canvas_size, canvas_size, blur_radius);
};

////////////////////////////////////////////////////////////////////////////////
// Detecting the face in the digest bitmap
////////////////////////////////////////////////////////////////////////////////

var detectFace = function (canvas) {
  var matches = ccv.detect_objects(
    { "canvas" : ccv.grayscale(ccv.pre(canvas)),
      "cascade" : cascade,
      "interval" : 5,
      "min_neighbors" : 1 });
  return matches;
};

var drawMatches = function (ui, matches) {
  // Just draw the first one
  // In testing, multiples were overlapping matches of the same feature
  var match = matches[0];
  //matches.forEach(function(match) {
  // Clamp to bitmap pixel boundaries
  var x = /*Math.round*/(match.x / canvas_scale) * canvas_scale;
  var y = /*Math.round*/(match.y / canvas_scale) * canvas_scale;
  var width = /*Math.round*/(match.width / canvas_scale) * canvas_scale;
  var height = /*Math.round*/(match.height / canvas_scale) * canvas_scale;
  ui.ctx.lineWidth = match_line_width;
  ui.ctx.strokeStyle = "rgb(255, 0, 0)";
  ui.ctx.rect(x ? x : 1, y ? y : 1, width, height);
  ui.ctx.stroke();
  ui.caption.innerHTML += "<br /><b>Face:</b>&nbsp;" +
    x + "," + y + "," + (x + width) + "," + (y + height);
  //});
};

////////////////////////////////////////////////////////////////////////////////
// Main flow of execution
////////////////////////////////////////////////////////////////////////////////

var nextBlock = function () {
  // Don't add too many elements to the page, we don't want to hog memory
  if ($('#blocks').find('.page-grid-cell').size() >= truncate_blocks_at) {
    $("#blocks").find(".page-grid-cell:lt(" +
                      Math.floor(truncate_blocks_at / 2) + ")").remove();
  }
  // Set up the state for the new block
  matches = Array();
  tries = 0;
  // Create the ui section for the new block
  ui = createSection("#blocks");
  $('html, body').animate({scrollTop: $(document).height()}, 'slow');
  // And do the work
  animationLoop();
};

var animationLoop = function () {
  if (matches.length == 0) {
    requestAnimFrame(animationLoop);
    tries = tries + 1;
    digest = newDigest();
    drawFace(ui, digest);
    matches = detectFace(ui.canvas);
  } else {
    drawMatches(ui, matches);
    previousDigest = digest;
    nextBlock();
  }
};
