var _ = require('underscore'),
	argv, optimist,
	Pong, Paddle, Ball;

optimist = require('optimist')
	.usage('Usage: $0 [--beep|--help|--width <number>|--height <number>]')
	.alias('W', 'width').describe('W', 'Set the width of the playing field').default('W', 80)
	.alias('H', 'height').describe('H', 'Set the height of the playing field').default('H', 24)
	.alias('b', 'beep').describe('b', 'Enable beeping').boolean('b').default('b', false)
	.alias('h', 'help').describe('h', 'Help!').boolean('h')
	
argv = optimist.argv;

if (argv.help) {
	optimist.showHelp();
	return process.exit();
}

/**
 * Repeat a string a certain amount of characters;
 * @param  {[type]} chars  [description]
 * @param  {[type]} length [description]
 * @return {[type]}        [description]
 */
var repeatString = function(chars, length) {
	var response = "",
		remaining = length,
		charCount = chars.length;

	while (remaining > 0) {
		response += chars.slice(0, Math.min(charCount, remaining)).toString();
		remaining = length - response.length;
	}

	return response;
};

/**
 * The main game, which manages all of the other objects etc.
 * 
 * @param {WriteableStream} output  Output. Should be STDOUT.
 * @param {ReadableStream}  input   Input. Should be STDIN.
 * @param {Object}          options Options to pass: width, height, beep.
 */
Pong = function(output, input, options) {
	if (!(this instanceof Pong)) {
		return new Pong(output, input, options);
	}

	this.output = output;
	this.input = input;
	this.options = _(options || {}).defaults({
		width: argv.W,
		height: argv.H,
		beep: argv.beep
	});

	this.ourPaddle = new Paddle(this, 1, (this.options.height / 2) | 0);
	this.theirPaddle = new Paddle(this, this.options.width, (this.options.height / 2) | 0);
	this.ball = new Ball(this, (this.options.width / 2) | 0, (this.options.height / 2) | 0);

	this.ourScore = 0;
	this.theirScore = 0;

	return this;
};
module.exports = Pong;

/**
 * Runs once every frame the game is playing.
 */
Pong.prototype.tick = function() {
	var self = this,
		output = this.output,
		height = this.options.height,
		width = this.options.width;

	// Draw the vertical borders and clear the screen
	var lineNumber = 1;
	while (lineNumber <= height) {
		output.goto(0, lineNumber)
			.blue()
			.write('.' + repeatString(' ', Math.floor(width/2-1)))
			.grey()
			.write('.' + repeatString(' ', Math.ceil(width/2-2)))
			.red()
			.write('.')
			.reset()
		lineNumber += 1;
	}

	// Draw the horizontal borders
	output.goto(0, 0)
		.write(repeatString('=', width))
		.goto(0, height)
		.write(repeatString('=', width));

	// Draw the scores
	output.goto(0, height+1)
		.write(this.ourScore+" US")
		.goto(width - this.theirScore.toString().length - 4, height+1)
		.write("THEM "+this.theirScore)
		.write('\n')

	// Move "their" paddle towards the ball,
	// with a maximum speed of 1 character/second.
	this.theirPaddle.y += Math.round(Math.max(
		Math.min(this.ball.y - this.theirPaddle.y, 1), -1
	));

	// Draw the objects
	this.ourPaddle.draw(output);
	this.theirPaddle.draw(output);
	this.ball.draw(output);

	// Instructions
	output.goto(0, height + 3);
	console.log('W: Move up  S: Move down  Q: Quit\nSHIFT: Hold to move faster');
};

/**
 * Beep if allowed.
 */
Pong.prototype.beep = Pong.prototype.bloop = function() {
	if (this.options.beep) {
		this.output.beep();
	}
}

/**
 * Start running the game, setting up timers and event listeners.
 * Can/should only be run once.
 */
Pong.prototype.start = function() {
	if (this.interval) { return false; }

	var self = this;

	this.interval = setInterval(function(){
		self.tick()
	}, 120);

	// Keyboard input.
	this.input.on('keypress', function(keyChar, keyInfo) {
		self.output.goto(0, self.options.height + 4);
		if (keyChar === '\u0003' || keyChar === 'q') {
			process.exit(keyChar === 'q' ? 0 : 1);
		}
		if (keyInfo && keyInfo.name) {
			switch (keyInfo.name) {
				case 'w':
					self.ourPaddle.y -= keyInfo.shift ? 2 : 1;
					self.ourPaddle.y = Math.max(self.ourPaddle.y, 3);
				break;
				case 's':
					self.ourPaddle.y += keyInfo.shift ? 2 : 1;
					self.ourPaddle.y = Math.min(self.ourPaddle.y, self.options.height - 2);
				break;
			}
		}
	});

	return this;
};

/**
 * Should clean up the mess, haven't tried it yet though.
 */
Pong.prototype.stop = function() {
	if (this.interval) {
		clearInterval(this.interval);
		this.interval = false;
	}
	if (this.input) {
		this.input.removeAllListeners();
	}
	return this;
}

/**
 * Paddles.
 * @param {Pong}   game
 * @param {Number} x    X position of the paddle
 * @param {Number} y    Y position of the paddle
 */
Paddle = function(game, x, y) {
	if (!(this instanceof Paddle)) {
		return new Paddle(game, x, y);
	}
	this.x = x; this.y = y;
	return this;
}

/**
 * Runs every frame on each paddle.
 * @param  {WriteableStream} output The stream to write to. Should be the same as `game`s.
 */
Paddle.prototype.draw = function(output) {
	var currHeight = this.y - 1;

	output.bg.white();
	while (currHeight <= this.y + 1) {
		output.goto(this.x, currHeight).write('|');
		currHeight += 1;
	}
	output.bg.reset();
};

/**
 * The Ball
 * @param {Pong}   game
 * @param {Number} x    X position of the ball
 * @param {Number} y    Y position of the ball
 */
Ball = function(game, x, y) {
	var self = this;
	if (!(this instanceof Ball)) {
		return new Ball(game, x, y);
	}
	this.xspd = Math.random() > 0.5 ? 1 : -1;
	this.yspd = Math.random() > 0.5 ? 1 : -1;
	this.xspd *= Math.random()*0.5+0.5;
	this.yspd *= Math.random()*0.75+0.25;
	this.x = x; this.y = y;
	this.game = game;
	this.moving = false;
	setTimeout(function(){
		self.moving = true;
	}, 750);
};

/**
 * Called every frame, and controls the movement/collisions/drawing
 * of the ball.
 * @param  {WriteableStream} output The stream to write to. Should be the same as `game`s.
 */
Ball.prototype.draw = function(output) {
	var game = this.game,
		height = game.options.height,
		width = game.options.width,
		ourPaddle = this.game.ourPaddle;
		theirPaddle = this.game.theirPaddle;
	
	if (this.moving) {
		this.x += this.xspd;
		this.y += this.yspd;

		if (this.y < 3 || this.y > height - 1) {
			this.yspd = -this.yspd;
			this.y = Math.min(this.y, height - 1);
			this.y = Math.max(this.y, 2);
			game.beep();
		}

		if (this.x <= ourPaddle.x && Math.abs(this.y - ourPaddle.y) < 3) {
			this.xspd = Math.abs(this.xspd);
			this.xspd *= 1.2; this.yspd *= 1.2;
			this.x = ourPaddle.x + 2;
			game.beep();
		} else
		if (this.x >= theirPaddle.x && Math.abs(this.y - theirPaddle.y) < 3) {
			this.xspd = -Math.abs(this.xspd);
			this.xspd *= 1.2; this.yspd *= 1.2;
			this.x = theirPaddle.x - 2;
			game.beep();
		}

		if (this.x < 0) {
			game.theirScore += 1;
			return game.ball = new Ball(game, (width/2)|0, (height/2)|0);
		} else
		if (this.x > width) {
			game.ourScore += 1;
			return game.ball = new Ball(game, (width/2)|0, (height/2)|0);
		}
	}

	output
		.goto(this.x | 0, this.y | 0)
		.write('⬛');
};