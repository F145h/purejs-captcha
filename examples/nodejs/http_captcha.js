var http = require("http")
var url = require('url');

var captchaFactory = require("../../distr/node-generic-captcha.js");

var captchaNumber = 0;

http.createServer(function(req, res) {
  var reqUrl = url.parse(req.url);
  switch(reqUrl.pathname)
  {
    case '/':
    {
        var html = new String()

        html += "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01//EN\" \"http://www.w3.org/TR/html4/strict.dtd\">\n";
        html += "<html>\n";
        html += "<head><title>node-generic-captcha - nodejs demo</title></head>"
        html += "<body>\n";
        html += "<div><img src='/captcha1.png' style='padding-bottom: 10px;' /></div>\n";
        html += "<div><img src='/captcha2.png' style='padding-bottom: 10px;' /></div>\n";
        html += "<div><img src='/captcha3.png' style='padding-bottom: 10px;' /></div>\n";
        html += "<div><img src='/captcha4.png' style='padding-bottom: 10px;' /></div>\n";
        html += "<div><img src='/captcha5.png' style='padding-bottom: 10px;' /></div>\n";
        html += "<div><img src='/captcha6.png' style='padding-bottom: 10px;' /></div>\n";
        html += "</body>\n";
        html += "</html>";

        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(html);
    }
    break;
    case '/captcha1.png':
    {
    	var captcha = captchaFactory.make()
        captcha.drawText("145 some text");
        captcha.addNoise({type: "simple"});
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(captcha.pngStream(), 'binary');
    }
    break;
    case '/captcha2.png':
    {
    	var captcha = captchaFactory.make()
        captcha.drawText("42 captcha!");
        captcha.addNoise({type: "simple", colored: true});
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(captcha.pngStream(), 'binary');
    }
    break;
    case '/captcha3.png':
    {
    	var captcha = captchaFactory.make({precisely : false})
        captcha.drawText("Hello world");
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(captcha.pngStream(), 'binary');
    }
    break;
    case '/captcha4.png':
    {
    	var captcha = captchaFactory.make({precisely : false})
        captcha.drawText("Captcha");
        captcha.addNoise();
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(captcha.pngStream(), 'binary');
    }
    break;
    case '/captcha5.png':
    {
      	var captcha = captchaFactory.make({precisely : false})
        captcha.drawText("TEXT");
        captcha.addNoise({colored: true});
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(captcha.pngStream(), 'binary');
    }
    break;
    case '/captcha6.png':
    {
        var captcha = captchaFactory.make({usePerlinBrush: true});
        captcha.drawText("Perlin noise");
        captcha.addNoise();
        res.end(captcha.pngStream(), 'binary');
    }
    break;
    default:
        res.writeHead(404, {'Content-Type': 'text/html'});
        res.end("Not found");
  }
}).listen(3030);
