
function PNGlib(width, height, depth) {

    // helper functions for that ctx
    function write(buffer, offs) {
        for (var i = 2; i < arguments.length; i++) {
            for (var j = 0; j < arguments[i].length; j++) {
                buffer[offs++] = arguments[i].charAt(j);
            }
        }
    }

    function byte2(w) {
        return String.fromCharCode((w >> 8) & 255, w & 255);
    }

    function byte4(w) {
        return String.fromCharCode((w >> 24) & 255, (w >> 16) & 255, (w >> 8) & 255, w & 255);
    }

    function byte2lsb(w) {
        return String.fromCharCode(w & 255, (w >> 8) & 255);
    }

    this.width = width;
    this.height = height;
    this.depth = depth;

    // pixel data and row filter identifier size
    this.pix_size = height * (width + 1);

    // deflate header, pix_size, block headers, adler32 checksum
    this.data_size = 2 + this.pix_size +
					5 * Math.floor((0xfffe + this.pix_size) / 0xffff) + 4;

    // offsets and sizes of Png chunks
    this.ihdr_offs = 0;
    this.ihdr_size = 4 + 4 + 13 + 4;
    this.plte_offs = this.ihdr_offs + this.ihdr_size;
    this.plte_size = 4 + 4 + 3 * depth + 4;
    this.trns_offs = this.plte_offs + this.plte_size;
    this.trns_size = 4 + 4 + depth + 4;
    this.idat_offs = this.trns_offs + this.trns_size;
    this.idat_size = 4 + 4 + this.data_size + 4;
    this.iend_offs = this.idat_offs + this.idat_size;
    this.iend_size = 4 + 4 + 4;
    this.buffer_size = this.iend_offs + this.iend_size;

    this.buffer = new Array();
    this.palette = new Object();
    this.pindex = 0;

    var _crc32 = new Array();

    // initialize buffer with zero bytes
    for (var i = 0; i < this.buffer_size; i++) {
        this.buffer[i] = "\x00";
    }

    // initialize non-zero elements
    write(this.buffer, this.ihdr_offs, byte4(this.ihdr_size - 12), 'IHDR',
					byte4(width), byte4(height), "\x08\x03");
    write(this.buffer, this.plte_offs, byte4(this.plte_size - 12), 'PLTE');
    write(this.buffer, this.trns_offs, byte4(this.trns_size - 12), 'tRNS');
    write(this.buffer, this.idat_offs, byte4(this.idat_size - 12), 'IDAT');
    write(this.buffer, this.iend_offs, byte4(this.iend_size - 12), 'IEND');

    // initialize deflate header
    var header = ((8 + (7 << 4)) << 8) | (3 << 6);
    header += 31 - (header % 31);

    write(this.buffer, this.idat_offs + 8, byte2(header));

    // initialize deflate block headers
    for (var i = 0; (i << 16) - 1 < this.pix_size; i++) {
        var size, bits;
        if (i + 0xffff < this.pix_size) {
            size = 0xffff;
            bits = "\x00";
        } else {
            size = this.pix_size - (i << 16) - i;
            bits = "\x01";
        }
        write(this.buffer, this.idat_offs + 8 + 2 + (i << 16) + (i << 2),
					bits, byte2lsb(size), byte2lsb(~size));
    }

    /* Create crc32 lookup table */
    for (var i = 0; i < 256; i++) {
        var c = i;
        for (var j = 0; j < 8; j++) {
            if (c & 1) {
                c = -306674912 ^ ((c >> 1) & 0x7fffffff);
            } else {
                c = (c >> 1) & 0x7fffffff;
            }
        }
        _crc32[i] = c;
    }

    // used internally
    this.index = function (x, y) {
        var i = y * (this.width + 1) + x + 1;
        var j = this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
        return j;
    }

    // set a pixel to the given color
    this.set = function (x, y, c) {
        var i = y * (this.width + 1) + x + 1;
        var j = this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
        this.buffer[j] = c;
    }

    // convert a color and build up the palette
    this.color = function (red, green, blue, alpha) {

        alpha = alpha >= 0 ? alpha : 255;
        var color = (((((alpha << 8) | red) << 8) | green) << 8) | blue;

        if (typeof this.palette[color] == "undefined") {
            if (this.pindex == this.depth) return "\x00";

            var ndx = this.plte_offs + 8 + 3 * this.pindex;

            this.buffer[ndx + 0] = String.fromCharCode(red);
            this.buffer[ndx + 1] = String.fromCharCode(green);
            this.buffer[ndx + 2] = String.fromCharCode(blue);
            this.buffer[this.trns_offs + 8 + this.pindex] =
											String.fromCharCode(alpha);

            this.palette[color] = String.fromCharCode(this.pindex++);
        }
        return this.palette[color];
    }

    // output a PNG string
    this.render = function () {

        // compute adler32 of output pixels + row filter bytes
        // NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <=
        // 2^32-1.
        var BASE = 65521; /* largest prime smaller than 65536 */
        var NMAX = 5552;
        var s1 = 1;
        var s2 = 0;
        var n = NMAX;

        for (var y = 0; y < this.height; y++) {
            for (var x = -1; x < this.width; x++) {
                s1 += this.buffer[this.index(x, y)].charCodeAt(0);
                s2 += s1;
                if ((n -= 1) == 0) {
                    s1 %= BASE;
                    s2 %= BASE;
                    n = NMAX;
                }
            }
        }
        s1 %= BASE;
        s2 %= BASE;
        write(this.buffer, this.idat_offs + this.idat_size - 8,
				byte4((s2 << 16) | s1));

        // compute crc32 of the PNG chunks
        function crc32(png, offs, size) {
            var crc = -1;
            for (var i = 4; i < size - 4; i += 1) {
                crc = _crc32[(crc ^ png[offs + i].charCodeAt(0)) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
            }
            write(png, offs + size - 4, byte4(crc ^ -1));
        }

        crc32(this.buffer, this.ihdr_offs, this.ihdr_size);
        crc32(this.buffer, this.plte_offs, this.plte_size);
        crc32(this.buffer, this.trns_offs, this.trns_size);
        crc32(this.buffer, this.idat_offs, this.idat_size);
        crc32(this.buffer, this.iend_offs, this.iend_size);

        var buf = new Buffer(8);
        buf.writeUInt8(137, 0);
        buf.writeUInt8(80, 1);
        buf.writeUInt8(78, 2);
        buf.writeUInt8(71, 3);
        buf.writeUInt8(13, 4);
        buf.writeUInt8(10, 5);
        buf.writeUInt8(26, 6);
        buf.writeUInt8(10, 7);
        // convert PNG to string
        return buf.toString('binary') + this.buffer.join('');
    }
}

var PI = 3.1415926

function Bitmap(precisely, usePerlinBrush) {
    this._clr = 0;					// currently active color
    var _clrs = {};					// color map
    var _nclr = 0;					// color count
    var _bits = [];					// the x,y,c bits
    this._minx = Infinity;
    this._miny = Infinity;
    this._maxx = 1;
    this._maxy = 1;
    this.precisely = precisely;
    this.usePerlinBrush = usePerlinBrush;

    this.color = function (r, g, b) {
        var rgb = (r << 16) | (g << 8) | b;
        if (!_clrs[rgb])
            _clrs[rgb] = { n: _nclr++ };
        this._clr = rgb;
    }

    this.set = function (x, y) {
        // postscript graphics work with floating-pt numbers

        x = Math.floor(x);
        y = Math.floor(y);

        if (this._minx > x) this._minx = x;
        if (this._maxx < x) this._maxx = x;
        if (this._miny > y) this._miny = y;
        if (this._maxy < y) this._maxy = y;

        if (!this.precisely) {
            y += Math.floor(Math.random()*3 - 2);
            //x += Math.floor(Math.random()*3 - 2);
        }

        if (this.usePerlinBrush) {
            var value = perlinNoise.perlin(x / 5, y / 5, 0); // !!!! 0

            value = (1 + value) * 1.1 * 128;

            this.color(value, value, value);
        }
       
        _bits.push([x, y, this._clr]);
    }

    this.addNoise = function(o) {

        var options = o;
        if (typeof options == "undefined") {
            options = { type:"simple"};
        }
        if (typeof options.colored == "undefined") {
            options.colored = false;
        }
        if (typeof options.type == "undefined") {
            options.type = "simple";
        }
         
        var colored = options.colored;

        var oldColor = this._clr;

        switch(options.type)
        {
            case "simple":
            {
                for (var ix = this._minx; ix <= this._maxx; ++ix)
                    for (var iy = this._miny; iy <= this._maxy; ++iy)
                    {
                        if (Math.random() > 0.75) {
                        var c = Math.random() * 255

                        if (colored)
                            this.color(c, c+64, c+128);

                        this.set(ix, iy)
                    }
                }
            }
            break;        
            case "perlin":
            {
                var max = -Infinity, min = Infinity;

                for (var ix = this._minx; ix <= this._maxx; ++ix)
                {
                    for (var iy = this._miny; iy <= this._maxy; ++iy)
                    {
                        var value = perlinNoise.perlin(ix / 5, iy / 5, 0); // !!!! 0

                        if (max < value) max = value;
                        if (min > value) min = value;

                        value = (1 + value) * 1.1 * 128;

                        this.color(value, value, value);

                        this.set(ix, iy)             
                    }
                }
            }
            break;
        }
        this._clr = oldColor;
    }

    this.pngStream = function () {
        // determine image width and height

        var w = this._maxx - this._minx + 1;
        var h = this._maxy - this._miny + 1;

        var png = new PNGlib(w, h, 256);

        // make sure the default color (index 0) is white
        png.color(0, 0, 0, 0);

        // map the colors
        var cmap = [];
        for (var rgb in _clrs)
            cmap[rgb] = png.color(rgb >> 16, (rgb >> 8) & 0xff, (rgb & 0xff), 255);

        for (var i = 0; i < _bits.length; i++) {
            // PostScript builds bottom-up, we build top-down.
            var x = _bits[i][0] - this._minx;
            var y = _bits[i][1] - this._miny;
            var c = cmap[_bits[i][2]];

            y = h - y - 1; 	// Invert y

            png.set(x, y, c);
        }

        if (this.usePerlinBrush)
          perlinNoise.nextCapcha();

        return png.render();
    }

    this.placeToCanvas = function(canvasId) {
  		var el = document.getElementById(canvasId);
  		if (_bits.length == 0) {
  			el.width  = 48;
  			el.height = 48;
  			el.getContext('2d').clearRect(0, 0, el.width, el.height);
  			el.style.visibility = 'visible';
  			return;
  		}

    	var w = this._maxx-this._minx+1;
    	var h = this._maxy-this._miny+1;

		  el.width  = w;
		  el.height = h;

  		var ctx = el.getContext('2d');
  		ctx.fillStyle = '#fff';
  		ctx.fillRect(0, 0, el.width, el.height);

  		var id  = ctx.getImageData(0, 0, el.width, el.height);
  		var dat = id.data;

  		for (var i = 0; i < _bits.length; i++) {
  			// PostScript builds bottom-up, we build top-down.
  			var x = _bits[i][0] - this._minx;
  			var y = _bits[i][1] - this._miny;
  			var c = _bits[i][2];

      		y = h - y - 1; 	// Invert y

  			var idx = (y * id.width + x) * 4
  			dat[idx++] = c >> 16;           // r
  			dat[idx++] = (c >> 8) & 0xff; // g
  			dat[idx++] = (c & 0xff);      // b
  			dat[idx]   = 255;
  		}
		  ctx.putImageData(id, 0, 0);
		  el.style.visibility = 'visible';

      if (this.usePerlinBrush)
        perlinNoise.nextCapcha();
	  }
}


function nodeGenericCaptcha(options)
{
    this.bitmap = new Bitmap(typeof options != "undefined" && typeof options.precisely != "undefined" ? options.precisely : true, 
                             typeof options != "undefined" && typeof options.usePerlinBrush != "undefined" ? options.usePerlinBrush : false);
    this.bitmap.color(0, 0, 0);

    this.drawText = function(text) {
        var bw = new BWIPJS;
        var opts = {};
        opts.includetext = bw.value(true);
        opts.alttext = bw.value(text);

        bw.bitmap(this.bitmap);
        bw.scale(1,1);
        bw.push(text);
        bw.push(opts);
        BWIPJScode128.call(bw);
    }

    this.height = function(v)
    {
        if (typeof v == 'undefined')
    		return this.bitmap._maxy - this.bitmap._miny;
        else
        	this.bitmap._maxy = this.bitmap._miny + v;
    }

    this.width = function(v)
    {
        if (typeof v == 'undefined')
    		return this.bitmap._maxx - this.bitmap._minx;
        else
        	this.bitmap._maxx = this.bitmap._minx + v;
    }

    this.pngStream = function() { return this.bitmap.pngStream(); }
    this.draw = function(canvasId) { this.bitmap.placeToCanvas(canvasId); }

    this.addNoise = function(options) { this.bitmap.addNoise(options); }
};

// node.js exports
if (typeof module != 'undefined' && typeof module.exports != 'undefined') {
    module.exports.make = function(opt) { return new nodeGenericCaptcha(opt) }
}