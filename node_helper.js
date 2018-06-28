/**
 * Magic Mirror
 * Node Helper: MMM-GPIO
 *
 * By David Dearden
 * MIT Licensed.
 */

/**
 * Load resources required by this module.  
 */
var NodeHelper = require("node_helper");
//var stringify = require("json-stringify-safe");
const url = require("url");
var axis = require("axis.js");
const exec = require("child_process").exec;
const Gpio = require('onoff').Gpio;
var piBlaster = require("pi-blaster.js");


/**
 * Use NodeHelper to create a module.  
 */
module.exports = NodeHelper.create({
	
	/**
	 * The minimum version of magic mirror that is required for this module to run. 
	 */
	requiresVersion: "2.2.1",
	
	/**
	 * Override the start function to run when the module is started up.  
	 * Used to provide initialization information to the console. 
	 */
	start: function() {
		var self = this;
		self.initializedLED = false;
		self.initializedOnOff = false;
		self.developerMode = false;
		self.processName = "";
		self.resources = {};
		
		this.expressApp.get("/" + self.name, function(req, res) { self.getHandler(req, res); });
		
		console.log(self.name + ": module started! Path: " + this.path);
	},
	
	/**
	 * Override the socketNotificationReceived function to handle notifications sent from the client script. 
	 * 
	 * @param notification (string) The type of notification sent
	 * @param payload (any) The data sent with the notification
	 */
	socketNotificationReceived: function(notification, payload) {
		var self = this;
		if (payload.developerMode) { console.log(self.name + ": Socket Notification Received: \"" + notification + "\"."); }
		
		if (notification === "GPIO_ACTION") {
			self.actionHandler(payload);
		} else if (notification === "INIT") {
			self.sendSocketNotification("LOG", { original: payload, message: ("INIT received from: " + payload.instanceID + "."), messageType: "dev" } );
			self.initializeResources(payload);
		}
	},
	
	/**
	 * The initializeResources function sets up the resource variables and calls the startPiBlaster
	 * 
	 * @param payload (object) The payload object from the socketNotification init request
	 */
	initializeResources: function(payload) {
		var self = this;
		var i, r;
		self.developerMode = payload.developerMode;
		var resourceList = Object.values(payload.resources);
		if (self.initializedLED || self.initializedOnOff) {
			if (self.developerMode) { self.sendSocketNotification("LOG", { original: payload, message: ("node_helper.js has already been initialized."), messageType: "dev" } ); }
		} else if (resourceList.length >= 1) {
			self.resources = payload.resources;
			var pinListLED = [];
			for (i = 0; i < resourceList.length; i++) {
				r = resourceList[i];
				if (r.type === "LED") {
					pinListLED.push(r.pin);
				}
			}
			if (pinListLED.length > 0) { self.startPiBlaster(payload.scriptPath, pinListLED.join(",")); }
			else { self.initOnOff(); }
			
		} else {
			if (self.developerMode) { self.sendSocketNotification("LOG", { original: payload, message: ("Unable to initialize node_helper.js.  No resources have been defined. "), messageType: "dev" } ); }
		}
	},
	
	/**
	 * The startPiBlaster function starts the PiBlaster program withthe sprcified GPIO pins enabled
	 * 
	 * @param piBlasterExe (string) The full path to the PrBlaster program executible
	 * @param gpio (string) The comma-separated list of GPIO pins to activate with PiBlaster
	 * @return (boolean) Returns true if the program started successfully, false otherwise
	 */
	startPiBlaster: function(piBlasterExe, gpio) {
		var self = this;
		var command = "sudo " + piBlasterExe + " -g " + gpio;
		if (self.developerMode) { console.log(self.name + ": startPiBlaster() Running command: \"" + command + "\""); }
		exec(command, { timeout: 1500 }, function(error, stdout, stderr) {
			if (!error) {
				self.sendSocketNotification("LOG", { original: null, message: ("Starting PiBlaster... Successfully started PiBlaster on GPIO pin(s) " + gpio + ".") } );
				console.log(self.name + ": Starting PiBlaster... Successfully started PiBlaster on GPIO pin(s) " + gpio + ".");
				self.setInitialValues();
				self.processName = piBlasterExe.substr(piBlasterExe.lastIndexOf("/") + 1);
				if (self.developerMode) { self.sendSocketNotification("LOG", { original: null, message: ("node_helper.js initialized successfully."), messageType: "dev" } ); }
			} else {
				self.sendSocketNotification("LOG", { original: null, message: ("Starting PiBlaster... Error: " + error) } );
				console.log(self.name + ": Starting PiBlaster... " + error);
				if (self.developerMode) { self.sendSocketNotification("LOG", { original: null, message: ("Unable to initialize node_helper.js."), messageType: "dev" } ); }
			}
			self.initOnOff();
		});
	},
	
	/**
	 * The setInitialValues function sets initial output values of the LED's once the
	 * module initialization is complete and the PiBlaster program has been started. 
	 */
	setInitialValues: function() {
		var self = this;
		var resourceList = Object.values(self.resources);
		self.initializedLED = true;
		for(var i = 0; i < resourceList.length; i++) {
			if (resourceList[i].type === "LED") {
				self.setLED(resourceList[i].name, resourceList[i].value);
			}
		}
	},
	
	/**
	 * The initOnOff function initializes all the onoff based resources
	 */
	initOnOff: function() {
		var self = this;
		var i, r;
		var resourceList = Object.values(self.resources);
		for (i = 0; i < resourceList.length; i++) {
			r = resourceList[i];
			if (r.type === "OUT") {
				self.initializedOnOff = true;
				r.onoff = new Gpio(r.pin, "out");
				self.actionHandler({ name: r.name, action: "SET", value: r.value });
			} else if (r.type === "BTN") {
				
			}
		}
	},
	
	/**
	 * The actionHandler function handles led actions received from various sources
	 * 
	 * @param payload (object) Contains the action parameters
	 */
	actionHandler: function(payload) {
		var self = this;
		
		if (self.developerMode) { console.log(self.name + ": actionHandler(): " + JSON.stringify(payload)); }
		
		var resource = self.resources[payload.name];
		if (axis.isUndefined(resource)) {
			 console.log(self.name + ": actionHandler(): There is no resource assigned to the name: \"" + payload.name + "\"."	);
			 return false;
		}
		if (!axis.isString(payload.action)) { return false; }
		payload.action = payload.action.toUpperCase();
		
		if (resource.type === "LED") {
			self.clearAnimation(payload.name);
			switch (payload.action) {
				case "SET": self.setLED(payload.name, payload.value); break;
				case "INCREASE": self.increaseLED(payload.name, payload.value); break;
				case "DECREASE": self.decreaseLED(payload.name, payload.value); break;
				case "TOGGLE": self.toggleLED(payload.name, payload.value); break;
				case "FLASH": self.flashLED(payload.name, payload.time, payload.offTime, payload.value); break;
				default: return false;
			}
		} else if (resource.type === "OUT") {
			switch (payload.action) {
				case "SET": self.setOUT(payload.name, payload.value); break;
				default: return false;
			}
		} else if (resource.type === "BTN") {
			
		} else {
			return false;
		}
		
		return true;
	},
	
	/**
	 * The getHandler function handles 'get' requests sent to the browset
	 * 
	 * @param req (object) Contains the request data
	 * @param res (object) Contains the response data
	 */
	getHandler: function(req, res) {
		var self = this;
		var output, resource;
		var payload = url.parse(req.url, true).query;
		
		if (self.developerMode) { console.log(self.name + ": getHandler(): " + JSON.stringify(payload)); }
		
		if (axis.isUndefined(self.resources[payload.name])) {
			res.send(JSON.stringify({ error: true, message: "There is no resource assigned to the name: \"" + payload.name + "\"."	}));
		} else {
			if (!axis.isString(payload.action)) {
				res.send(JSON.stringify({ error: true, message: "The provided action must be a string." }));
				return;
			}
			payload.action = payload.action.toUpperCase();
			if (payload.action === "GET_ALL") {
				var resources = [];
				var resourceList = Object.values(self.resources);
				for (var i = 0; i < resourceList.length; i++) {
					resource = Object.assign({}, resourceList[i], { animation: null, onoff: null });
					delete resource.animation;
					delete resource.onoff;
					resources.push(resource);
				}
				output = Object.assign({ error: false }, { data: resources });
				res.send(JSON.stringify(output));
			} else if (payload.action === "GET" || self.actionHandler(payload)) {
				resource = Object.assign({}, self.resources[payload.name], { animation: null, onoff: null });
				delete resource.animation;
				delete resource.onoff;
				output = Object.assign({ error: false }, { data: resource });
				res.send(JSON.stringify(output));
			} else {
				res.send(JSON.stringify({ error: true, message: "The action \" + payload.action + \" is not valid." }));
			}
		}
	},
	
	/**
	 * The setOUT function sets the output value of a given resource.
	 * 
	 * @param name (string) The name of the resource to set
	 * @param value (number) The value to assign to the specified resource
	 */
	setOUT: function(name, value) {
		var self = this;
		value = Number(value);
		if (!self.initializedOnOff || axis.isUndefined(self.resources[name]) || (value !== 0 && value !== 1)) { return; }
		var r = self.resources[name];
		if (self.developerMode) { console.log(self.name + ": setOUT(): Name: \"" + name + "\" Pin: \"" + r.pin + "\" value: \"" + value + "\""); }
		var actualValue = value;
		if (r.activeLow) { actualValue = value === 0 ? 1 : 0; }
		
		r.onoff.write(actualValue, function(err) {
			if (err && self.developerMode) {
				console.log(self.name + ": setOUT(): Unable to set resource \"" + name + "\" to value \"" + value + "\".  Error: \"" + JSON.stringify(err) + "\"");
			} else {
				r.value = value;
			}
		});
	},
	
	/**
	 * The clearAnimation function clears any animation that might be runnig on a given resource.
	 */
	clearAnimation: function(ledName) {
		var self = this;
		if (!self.initializedLED || axis.isUndefined(self.resources[ledName])) { return; }
		clearTimeout(self.resources[ledName].animation);
	},
	
	/**
	 * The setLED function sets the output value of an LED on a given pin.
	 * 
	 * @param ledName (string) The name of the resource to update
	 * @param value (number) The value to assign to the specified resource
	 */
	setLED: function(ledName, value) {
		var self = this;
		value = Number(value);
		if (!self.initializedLED || axis.isUndefined(self.resources[ledName]) || !axis.isNumber(value) || isNaN(value)) { return; }
		var r = self.resources[ledName];
		if (value > 1) { value = 1; }
		else if (value < 0) { value = 0; }
		
		if (self.developerMode) { console.log(self.name + ": setLED(): Name: \"" + ledName + "\" Pin: \"" + r.pin + "\" value: \"" + value + "\""); }
		
		r.value = value;
		if (r.activeLow) { value = 1 - value; }
		piBlaster.setPwm(r.pin, value);
	},
	
	/**
	 * The increaseLED function increases the value by the given amount
	 * 
	 * @param ledName (string) The name of the resource to update
	 * @param value (number) The value to increase the resource by
	 */
	increaseLED: function(ledName, value) {
		var self = this;
		value = Number(value);
		if (!self.initializedLED || axis.isUndefined(self.resources[ledName])) { return; }
		if (!axis.isNumber(value) || isNaN(value)) { value = 0.1; }
		var r = self.resources[ledName];
		
		if (self.developerMode) { console.log(self.name + ": increaseLED(): Name: \"" + ledName + "\" value: \"" + value + "\""); }
		
		self.setLED(ledName, r.value + value);
	},
	
	/**
	 * The decreaseLED function decreases the value by the given amount
	 * 
	 * @param ledName (string) The name of the resource to update
	 * @param value (number) The value to decrease the resource by
	 */
	decreaseLED: function(ledName, value) {
		var self = this;
		value = Number(value);
		if (!self.initializedLED || axis.isUndefined(self.resources[ledName])) { return; }
		if (!axis.isNumber(value) || isNaN(value)) { value = 0.1; }
		var r = self.resources[ledName];
		
		if (self.developerMode) { console.log(self.name + ": decreaseLED(): Name: \"" + ledName + "\" value: \"" + value + "\""); }
		
		self.setLED(ledName, r.value - value);
	},
	
	/**
	 * The toggleLED function toggles the LED on and off, using the last value as its on level
	 * 
	 * @param ledName (string) The name of the resource to update
	 */
	toggleLED: function(ledName, value) {
		var self = this;
		if (!self.initializedLED || axis.isUndefined(self.resources[ledName])) { return; }
		value = Number(value);
		if (!axis.isNumber(value) || isNaN(value) || value <= 0 || value > 1) { value = null; }
		var r = self.resources[ledName];
		if (self.developerMode) { console.log(self.name + ": toggleLED(): Name: \"" + ledName + "\" value: \"" + value + "\""); }
		
		if (r.value === 0) {
			if (!axis.isNull(value)) { self.setLED(ledName, value); }
			else if (axis.isUndefined(r.toggleValue)) { self.setLED(ledName, 1); }
			else { self.setLED(ledName, r.toggleValue); }
		} else {
			r.toggleValue = r.value;
			self.setLED(ledName, 0);
		}
	},
	
	/**
	 * The toggleLED function toggles the LED on and off, using the last value as its on level
	 * 
	 * @param ledName (string) The name of the resource to update
	 */
	flashLED: function(ledName, time, offTime, value) {
		var self = this;
		if (!self.initializedLED || axis.isUndefined(self.resources[ledName])) { return; }
		time = Number(time);
		offTime = Number(offTime);
		value = Number(value);
		if (!axis.isNumber(time) || isNaN(time) || time <= 0) { time = 750; }
		if (!axis.isNumber(offTime) || isNaN(offTime) || offTime <= 0) { offTime = time; }
		if (!axis.isNumber(value) || isNaN(value) || value <= 0 || value > 1) { value = null; }
		var r = self.resources[ledName];
		if (self.developerMode) { console.log(self.name + ": flashLED(): Name: \"" + ledName + "\" value: \"" + value + "\" time: \"" + time + "\" offTime: \"" + offTime + "\""); }
		
		var flashON, flashOFF;
		
		flashON = function() {
			self.toggleLED(ledName, value);
			r.animation = setTimeout(function(){ flashOFF(); }, time);
		};
		
		flashOFF = function() {
			self.toggleLED(ledName, value);
			r.animation = setTimeout(function(){ flashON(); }, offTime);
		};
		
		if (r.value === 0) { flashON(); } else { flashOFF(); }
	},
	
	/**
	 * The stop function releases any resources in use when the application exits.
	 */
	stop: function() {
		var self = this;
		//exec("sudo pkill " + self.processName, { timeout: 1500 }, function(error, stdout, stderr) { });
		if (!self.initializedLED) { return; }
		var resourceList = Object.values(self.resources);
		for(var i = 0; i < resourceList.length; i++) {
			var r = resourceList[i];
			if (r.type === "LED") {
				if (!axis.isNull(r.exitValue)) {
					self.setLED(r.name, r.exitValue);
				}
			} else if (r.type === "OUT") {
				r.onoff.unexport();
			} else if (r.type === "BTN") {
				
			}
		}
	}
	
});
