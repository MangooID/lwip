(function(undefined) {

    var path = require('path'),
        fs = require('fs'),
        async = require('async'),
        decree = require('decree'),
        defs = require('./defs'),
        decoder = require('./build/Release/lwip_decoder'),
        encoder = require('./build/Release/lwip_encoder'),
        lwip_image = require('./build/Release/lwip_image');

    var openers = [{
        exts: ['jpg', 'jpeg'],
        opener: decoder.jpeg
    }, {
        exts: ['png'],
        opener: decoder.png
    }];

    function undefinedFilter(v) {
        return v !== undefined;
    }

    function normalizeColor(color) {
        if (typeof color === 'string') {
            if (defs.colors[color]) color = defs.colors[color];
            else throw Error('Unknown color ' + color);
        } else {
            if (color instanceof Array) {
                color = {
                    r: color[0],
                    g: color[1],
                    b: color[2],
                    a: color[3]
                };
            }
            if (color.a !== 0) color.a = color.a || defs.defaults.DEF_COLOR_ALPHA;
            if (color.r != parseInt(color.r) || color.r < 0 || color.r > 255)
                throw Error('\'red\' color component is invalid');
            if (color.g != parseInt(color.g) || color.g < 0 || color.g > 255)
                throw Error('\'green\' color component is invalid');
            if (color.b != parseInt(color.b) || color.b < 0 || color.b > 255)
                throw Error('\'blue\' color component is invalid');
            if (color.a != parseInt(color.a) || color.a < 0 || color.a > 100)
                throw Error('\'alpha\' color component is invalid');
        }
        return color;
    }

    function image(pixelsBuf, width, height, trans) {
        this.__lwip = new lwip_image.LwipImage(pixelsBuf, width, height);
        this.__locked = false;
        this.__trans = trans;
    }

    image.prototype.__lock = function() {
        if (!this.__locked) this.__locked = true;
        else throw Error("Another image operation already in progress");
    };

    image.prototype.__release = function() {
        this.__locked = false;
    };

    image.prototype.width = function() {
        return this.__lwip.width();
    }

    image.prototype.height = function() {
        return this.__lwip.height();
    }

    image.prototype.size = function() {
        return {
            width: this.__lwip.width(),
            height: this.__lwip.height()
        };
    }

    image.prototype.scale = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.scale)(arguments, function(wRatio, hRatio, inter, callback) {
                if (!defs.interpolations[inter]) throw Error("Unknown interpolation " + inter);
                hRatio = hRatio || wRatio;
                var width = +wRatio * that.width(),
                    height = +hRatio * that.height();
                that.__lwip.resize(width, height, defs.interpolations[inter], function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.resize = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.resize)(arguments, function(width, height, inter, callback) {
                if (!defs.interpolations[inter]) throw Error("Unknown interpolation " + inter);
                height = height || width;
                that.__lwip.resize(+width, +height, defs.interpolations[inter], function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.rotate = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.rotate)(arguments, function(degs, color, callback) {
                color = normalizeColor(color);
                if (color.a < 100) that.__trans = true;
                that.__lwip.rotate(+degs, +color.r, +color.g, +color.b, +color.a, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.blur = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.blur)(arguments, function(sigma, callback) {
                that.__lwip.blur(+sigma, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.hslaAdjust = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.hslaAdjust)(arguments, function(hs, sd, ld, ad, callback) {
                that.__lwip.hslaAdj(+hs, +sd, +ld, +ad, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.saturate = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.saturate)(arguments, function(delta, callback) {
                that.__lwip.hslaAdj(0, +delta, 0, 0, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.lighten = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.lighten)(arguments, function(delta, callback) {
                that.__lwip.hslaAdj(0, 0, +delta, 0, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.darken = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.darken)(arguments, function(delta, callback) {
                that.__lwip.hslaAdj(0, 0, -delta, 0, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.fade = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.fade)(arguments, function(delta, callback) {
                that.__lwip.hslaAdj(0, 0, 0, -delta, function(err) {
                    if (+delta > 0) that.__trans = true;
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.opacify = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.opacify)(arguments, function(callback) {
                that.__lwip.opacify(function(err) {
                    that.__trans = false;
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.hue = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.hue)(arguments, function(shift, callback) {
                that.__lwip.hslaAdj(+shift, 0, 0, 0, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.crop = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.crop)(arguments, function(left, top, right, bottom, callback) {
                if (!right && !bottom) {
                    var size = that.size(),
                        width = left,
                        height = top;
                    left = 0 | (size.width - width) / 2;
                    top = 0 | (size.height - height) / 2;
                    right = left + width - 1;
                    bottom = top + height - 1;
                }
                that.__lwip.crop(left, top, right, bottom, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.mirror = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.mirror)(arguments, function(axes, callback) {
                var xaxis = false,
                    yaxis = false;
                axes = axes.toLowerCase();
                if ('x' === axes) xaxis = true;
                if ('y' === axes) yaxis = true;
                if ('xy' === axes || 'yx' === axes) {
                    xaxis = true;
                    yaxis = true;
                }
                if (!(xaxis || yaxis)) throw Error('Invalid axes');
                that.__lwip.mirror(xaxis, yaxis, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    // mirror alias:
    image.prototype.flip = image.prototype.mirror;

    image.prototype.pad = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.pad)(arguments, function(left, top, right, bottom, color, callback) {
                color = normalizeColor(color);
                if (color.a < 100) that.__trans = true;
                that.__lwip.pad(+left, +top, +right, +bottom, +color.r, +color.g, +color.b, +color.a, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.border = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.border)(arguments, function(width, color, callback) {
                color = normalizeColor(color);
                if (color.a < 100) that.__trans = true;
                // we can just use image.pad...
                that.__lwip.pad(+width, +width, +width, +width, +color.r, +color.g, +color.b, +color.a, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.sharpen = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.sharpen)(arguments, function(amplitude, callback) {
                that.__lwip.sharpen(+amplitude, function(err) {
                    that.__release();
                    callback(err, that);
                });
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.clone = function() {
        // no need to lock the image. we don't modify the memory buffer.
        // just copy it.
        var that = this;
        decree(defs.args.clone)(arguments, function(callback) {
            // first we retrieve what we need (buffer, dimensions, ...)
            // synchronously so that the original image doesn't have a chance
            // to be changed (remember, we don't lock it); and only then call
            // the callback asynchronously.
            var pixbuff = that.__lwip.buffer(),
                width = that.__lwip.width(),
                height = that.__lwip.height(),
                trans = that.__trans;
            setImmediate(function() {
                callback(null, new image(pixbuff, width, height, trans));
            });
        });
    }

    image.prototype.extract = function() {
        // no need to lock the image. we don't modify the memory buffer.
        // just copy it and then crop it.
        var that = this;
        decree(defs.args.extract)(arguments, function(left, top, right, bottom, callback) {
            // first we retrieve what we need (buffer, dimensions, ...)
            // synchronously so that the original image doesn't have a chance
            // to be changed (remember, we don't lock it); then we crop it and
            // only call the callback asynchronously.
            var pixbuff = that.__lwip.buffer(),
                width = that.__lwip.width(),
                height = that.__lwip.height(),
                trans = that.__trans,
                eximg = new image(pixbuff, width, height, trans);
            eximg.__lwip.crop(left, top, right, bottom, function(err) {
                callback(err, eximg);
            });
        });
    }

    image.prototype.toBuffer = function() {
        this.__lock();
        try {
            var that = this;
            decree(defs.args.toBuffer)(arguments, function(type, params, callback) {
                if (type === 'jpg' || type === 'jpeg') {
                    if (params.quality != 0)
                        params.quality = params.quality || defs.defaults.DEF_JPEG_QUALITY;
                    if (params.quality != parseInt(params.quality) || params.quality < 0 || params.quality > 100)
                        throw Error('Invalid JPEG quality');
                    return encoder.jpeg(
                        that.__lwip.buffer(),
                        that.__lwip.width(),
                        that.__lwip.height(),
                        params.quality,
                        function(err, buffer) {
                            that.__release();
                            callback(err, buffer);
                        }
                    );
                } else if (type === 'png') {
                    params.compression = params.compression || defs.defaults.PNG_DEF_COMPRESSION;
                    if (params.compression === 'none') params.compression = 0;
                    else if (params.compression === 'fast') params.compression = 1;
                    else if (params.compression === 'high') params.compression = 2;
                    else throw Error('Invalid PNG compression');
                    params.interlaced = params.interlaced || defs.defaults.PNG_DEF_INTERLACED;
                    if (typeof params.interlaced !== 'boolean') throw Error('PNG \'interlaced\' must be boolean');
                    params.transparency = params.transparency || defs.defaults.PNG_DEF_TRANSPARENT;
                    if (typeof params.transparency !== 'boolean' && params.transparency.toLowerCase() !== 'auto')
                        throw Error('PNG \'transparency\' must be boolean or \'auto\'');
                    if (params.transparency.toLowerCase() !== 'auto') params.transparency = that.__trans;
                    return encoder.png(
                        that.__lwip.buffer(),
                        that.__lwip.width(),
                        that.__lwip.height(),
                        params.compression,
                        params.interlaced,
                        params.transparency,
                        function(err, buffer) {
                            that.__release();
                            callback(err, buffer);
                        }
                    );
                } else throw Error('Unknown type \'' + type + '\'');
            });
        } catch (e) {
            this.__release();
            throw e;
        }
    }

    image.prototype.writeFile = function() {
        var that = this;
        decree(defs.args.writeFile)(arguments, function(outpath, type, params, callback) {
            type = type || path.extname(outpath).slice(1).toLowerCase();
            that.toBuffer(type, params, function(err, buffer) {
                if (err) return callback(err);
                fs.writeFile(outpath, buffer, {
                    encoding: 'binary'
                }, callback);
            });
        });
    }

    image.prototype.batch = function() {
        return new batch(this);
    }

    function batch(image) {
        this.__image = image;
        this.__queue = [];
        this.__running = false;
        this.__addOp = function(handle, args) {
            this.__queue.push({
                handle: handle,
                args: args
            });
        };
    }

    batch.prototype.exec = function(callback) {
        var that = this;
        if (that.__running) throw Error("Batch is already running");
        that.__running = true;
        async.eachSeries(this.__queue, function(op, done) {
            op.args.push(done);
            op.handle.apply(that.__image, op.args);
        }, function(err) {
            that.__queue.length = 0; // queue is now empty
            that.__running = false;
            callback(err, that.__image);
        });
    }

    batch.prototype.scale = function() {
        var that = this,
            decs = defs.args.scale.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(wRatio, hRatio, inter) {
            if (!defs.interpolations[inter]) throw Error("Unknown interpolation " + inter);
            that.__addOp(that.__image.scale, [wRatio, hRatio, inter].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.resize = function() {
        var that = this,
            decs = defs.args.resize.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(width, height, inter) {
            if (!defs.interpolations[inter]) throw Error("Unknown interpolation " + inter);
            that.__addOp(that.__image.resize, [width, height, inter].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.rotate = function() {
        var that = this,
            decs = defs.args.rotate.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(degs, color) {
            color = normalizeColor(color);
            that.__addOp(that.__image.rotate, [degs, color].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.blur = function() {
        var that = this,
            decs = defs.args.blur.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(sigma) {
            that.__addOp(that.__image.blur, [sigma].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.hslaAdjust = function() {
        var that = this,
            decs = defs.args.hslaAdjust.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(hs, sd, ld, ad) {
            that.__addOp(that.__image.hslaAdjust, [hs, sd, ld, ad].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.saturate = function() {
        var that = this,
            decs = defs.args.saturate.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(delta) {
            that.__addOp(that.__image.saturate, [delta].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.lighten = function() {
        var that = this,
            decs = defs.args.lighten.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(delta) {
            that.__addOp(that.__image.lighten, [delta].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.darken = function() {
        var that = this,
            decs = defs.args.darken.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(delta) {
            that.__addOp(that.__image.darken, [delta].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.fade = function() {
        var that = this,
            decs = defs.args.fade.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(delta) {
            that.__addOp(that.__image.fade, [delta].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.opacify = function() {
        this.__addOp(this.__image.opacify, []);
        return this;
    }

    batch.prototype.hue = function() {
        var that = this,
            decs = defs.args.hue.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(shift) {
            that.__addOp(that.__image.hue, [shift].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.crop = function() {
        var that = this,
            decs = defs.args.crop.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(left, top, right, bottom) {
            that.__addOp(that.__image.crop, [left, top, right, bottom].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.mirror = function() {
        var that = this,
            decs = defs.args.mirror.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(axes) {
            axes = axes.toLowerCase();
            if (['x', 'y', 'xy', 'yx'].indexOf(axes) === -1) throw Error('Invalid axes');
            that.__addOp(that.__image.mirror, [axes].filter(undefinedFilter));
        });
        return this;
    }

    // mirror alias:
    batch.prototype.flip = batch.prototype.mirror;

    batch.prototype.pad = function() {
        var that = this,
            decs = defs.args.pad.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(left, top, right, bottom, color) {
            color = normalizeColor(color);
            that.__addOp(that.__image.pad, [left, top, right, bottom, color].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.border = function() {
        var that = this,
            decs = defs.args.border.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(width, color) {
            color = normalizeColor(color);
            that.__addOp(that.__image.border, [width, color].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.sharpen = function() {
        var that = this,
            decs = defs.args.sharpen.slice(0, -1); // cut callback declaration
        decree(decs)(arguments, function(amplitude) {
            that.__addOp(that.__image.sharpen, [amplitude].filter(undefinedFilter));
        });
        return this;
    }

    batch.prototype.toBuffer = function() {
        var that = this;
        decree(defs.args.toBuffer)(arguments, function(type, params, callback) {
            if (type === 'jpg' || type === 'jpeg') {
                if (params.quality != 0)
                    params.quality = params.quality || defs.defaults.DEF_JPEG_QUALITY;
                if (params.quality != parseInt(params.quality) || params.quality < 0 || params.quality > 100)
                    throw Error('Invalid JPEG quality');
            } else if (type === 'png') {
                params.compression = params.compression || defs.defaults.PNG_DEF_COMPRESSION;
                if (['none', 'fast', 'high'].indexOf(params.compression) === -1)
                    throw Error('Invalid PNG compression');
                params.interlaced = params.interlaced || defs.defaults.PNG_DEF_INTERLACED;
                if (typeof params.interlaced !== 'boolean') throw Error('PNG \'interlaced\' must be boolean');
                params.transparency = params.transparency || defs.defaults.PNG_DEF_TRANSPARENT;
                if (typeof params.transparency !== 'boolean' && params.transparency.toLowerCase() !== 'auto')
                    throw Error('PNG \'transparency\' must be boolean or \'auto\'');
            } else throw Error('Unknown type \'' + type + '\'');
            that.exec(function(err, image) {
                if (err) return callback(err);
                image.toBuffer(type, params, callback);
            });
        });
    }

    batch.prototype.writeFile = function(outpath, type, params, callback) {
        var that = this;
        decree(defs.args.writeFile)(arguments, function(outpath, type, params, callback) {
            type = type || path.extname(outpath).slice(1).toLowerCase();
            that.toBuffer(type, params, function(err, buffer) {
                if (err) return callback(err);
                fs.writeFile(outpath, buffer, {
                    encoding: 'binary'
                }, callback);
            });
        });
    }

    function open() {
        decree(defs.args.open)(arguments, function(source, type, callback) {
            if (typeof source === 'string') {
                type = type || path.extname(source).slice(1);
                var opener = getOpener(type);
                fs.readFile(source, function(err, imbuff) {
                    if (err) return callback(err);
                    opener(imbuff, function(err, pixelsBuf, width, height, channels, trans) {
                        callback(err, err ? undefined : new image(pixelsBuf, width, height, trans));
                    });
                });
            } else if (source instanceof Buffer) {
                var opener = getOpener(type);
                opener(source, function(err, pixelsBuf, width, height, channels, trans) {
                    callback(err, err ? undefined : new image(pixelsBuf, width, height, trans));
                });
            } else throw Error("Invalid source");
        });
    }

    function getOpener(ext) {
        ext = ext.toLowerCase();
        for (var i = 0; i < openers.length; i++) {
            var opener = openers[i].opener,
                exts = openers[i].exts;
            if (exts.indexOf(ext) !== -1) return opener;
        }
        throw Error('Unknown type \'' + ext + '\'');
    }

    function create() {
        decree(defs.args.create)(arguments, function(width, height, color, callback) {
            color = normalizeColor(color);
            var trans = color.a < 100,
                c_len = width * height,
                pixelsBuf = new Buffer(c_len * 4);
            for (var i = 0; i < width * height; i++) {
                pixelsBuf[i] = color.r;
                pixelsBuf[c_len + i] = color.g;
                pixelsBuf[2 * c_len + i] = color.b;
                pixelsBuf[3 * c_len + i] = color.a;
            }
            setImmediate(function() {
                callback(null, new image(pixelsBuf, width, height, trans));
            });
        });
    }

    // EXPORTS
    // -------
    module.exports = {
        open: open,
        create: create
    };
})(void 0);
