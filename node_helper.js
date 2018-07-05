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
		self.scenes = {};
		self.animations = {};
		self.buttonTimeouts = {};
		self.onoff = {};
		self.buttonActions = [ "PRESS", "DOUBLE_PRESS", "TRIPPLE_PRESS", "RELEASE", "DOUBLE_RELEASE", "TRIPPLE_RELEASE", "LONG_PRESS"];
		
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
	 * The initializeResources function sets up the resource variables then initializes 'onoff' and 'pi-blaster'
	 * 
	 * @param payload (object) The payload object from the socketNotification init request
	 */
	initializeResources: function(payload) {
		var self = this;
		var resourceList = Object.values(payload.resources);
		if (self.initializedLED || self.initializedOnOff) {
			self.sendSocketNotification("LOG", { original: payload, message: ("node_helper.js has already been initialized."), messageType: "dev" } );
			if (payload.developerMode) { console.log(self.name + ": node_helper.js has already been initialized."); }
		} else if (resourceList.length >= 1) {
			self.developerMode = payload.developerMode;
			self.resources = payload.resources;
			var pinListLED = [];
			for (var i = 0; i < resourceList.length; i++) {
				if (resourceList[i].type === "LED") { pinListLED.push(resourceList[i].pin); }
			}
			if (pinListLED.length > 0) { self.startPiBlaster(payload.scriptPath, pinListLED.join(",")); }
			else { self.initOnOff(); }
			self.scenes = payload.scenes;
		} else {
			self.sendSocketNotification("LOG", { original: payload, message: ("Unable to initialize node_helper.js.  No resources have been defined. "), messageType: "dev" } );
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
		var resourceList = Object.keys(self.resources);
		self.initializedLED = true;
		for (var i = 0; i < resourceList.length; i++) {
			var r = self.resources[resourceList[i]];
			if (r.type === "LED") {
				var value = r.value;
				r.value = null;
				self.setLED(r, value);
			}
		}
	},
	
	/**
	 * The initOnOff function initializes all the onoff based resources
	 */
	initOnOff: function() {
		var self = this;
		var i, r, options;
		
		self.sendSocketNotification("LOG", { original: null, message: ("Initializing Buttons and/or Outputs.") } );
		console.log(self.name + ": Initializing Buttons and/or Outputs.");
		
		var resourceList = Object.keys(self.resources);
		for (i = 0; i < resourceList.length; i++) {
			r = self.resources[resourceList[i]];
			if (r.type === "OUT") {
				if (self.developerMode) { console.log(self.name + ": Initializing resource (Output) \"" + r.name + "\" on pin \"" + r.pin + "\"."); }
				self.initializedOnOff = true;
				self.onoff[r.name] = new Gpio(r.pin, "out");
				self.setOUT(r, r.value);
			} else if (r.type === "BTN") {
				if (r.numShortPress < 1 && !r.enableLongPress) {
					if (self.developerMode) { console.log(self.name + ": Not Initializing resource (Button) \"" + r.name + "\" on pin \"" + r.pin + "\".  No actions are assigned."); }
					continue;
				}
				if (self.developerMode) { console.log(self.name + ": Initializing resource (Button) \"" + r.name + "\" on pin \"" + r.pin + "\"."); }
				self.initializedOnOff = true;
				r.pressCount = 0;
				r.releaseCount = 0;
				r.isPressed = false;
				r.pressID = r.name + "1";
				r.releaseID = r.name + "2";
				r.longPressID = r.name + "3";
				r.longPressAlertID = r.name + "4";
				r.longPressAlertIsActive = false;
				if (r.debounceTimeout > 0) { options = { debounceTimeout: r.debounceTimeout, activeLow: r.activeLow }; }
				else { options = { activeLow: r.activeLow }; }
				// Create onoff object
				self.onoff[r.name] = new Gpio(r.pin, "in", "both", options);
				// Add the interrupt callback
				self.onoff[r.name].watch(self.watchHandler(r));
				
			}
		}
	},
	
	/**
	 * The watchHandler function handles iunterrupt events for buttons
	 * 
	 * @param r (object) The resource object
	 */
	watchHandler: function(r) {
		var self = this;
		
		return function (err, value) {
			
			if (err) {
				if (self.developerMode) { console.log(self.name + ": watchHandler(): \"" + r.name + "\" error: \"" + JSON.stringify(err) + "\""); }
				return;
			}
			
			if (value === 1 && !r.isPressed) {
				var triggerPress;
				r.isPressed = true;
				r.pressCount++;
				
				if (r.pressCount === 1) {
					
					r.releaseCount = 1;
					
					triggerPress = function() {
						r.pressCount = 0;
						self.buttonPressHandler(r, "PRESS");
					};
					
					if (r.numShortPress === 1) { triggerPress(); }
					else if (r.numShortPress > 1) { self.buttonTimeouts[r.pressID] = setTimeout(triggerPress, r.multiPressTimeout); }
					else { r.pressCount = r.releaseCount = 0; }
					
					if (r.enableLongPress) {
						
						self.buttonTimeouts[r.longPressID] = setTimeout(function(){
							r.releaseCount = 4;
							self.buttonPressHandler(r, "LONG_PRESS");
						}, r.longPressTime + r.multiPressTimeout);
						
						if (!axis.isNull(r.longPressAlert)) {
							self.buttonTimeouts[r.longPressAlertID] = setTimeout(function(){
								r.releaseCount = 0;
								self.triggerAlert(r);
							}, r.multiPressTimeout);
						}
						
					}
					
				} else if (r.pressCount === 2) {
					
					clearTimeout(self.buttonTimeouts[r.pressID]);
					clearTimeout(self.buttonTimeouts[r.releaseID]);
					
					r.releaseCount = 2;
					
					triggerPress = function() {
						r.pressCount = 0;
						self.buttonPressHandler(r, "DOUBLE_PRESS");
					};
					
					if (r.numShortPress === 2) { triggerPress(); }
					else if (r.numShortPress > 2) { self.buttonTimeouts[r.pressID] = setTimeout(triggerPress, r.multiPressTimeout); }
					
				} else if (r.pressCount === 3) {
					
					clearTimeout(self.buttonTimeouts[r.pressID]);
					clearTimeout(self.buttonTimeouts[r.releaseID]);
					r.releaseCount = 3;
					r.pressCount = 0;
					self.buttonPressHandler(r, "TRIPPLE_PRESS");
					
				}
				
			} else if (value === 0 && r.isPressed) {
				r.isPressed = false;
				
				clearTimeout(self.buttonTimeouts[r.longPressID]);
				clearTimeout(self.buttonTimeouts[r.longPressAlertID]);
				
				if (r.releaseCount === 1) {
					if (r.numShortPress === 1) {
						self.buttonPressHandler(r, "RELEASE");
					} else {
						self.buttonTimeouts[r.releaseID] = setTimeout(function(){ self.buttonPressHandler(r, "RELEASE"); }, r.multiPressTimeout);
					}
				} else if (r.releaseCount === 2) {
					if (r.numShortPress === 2) {
						self.buttonPressHandler(r, "DOUBLE_RELEASE");
					} else {
						self.buttonTimeouts[r.releaseID] = setTimeout(function(){ self.buttonPressHandler(r, "DOUBLE_RELEASE"); }, r.multiPressTimeout);
					}
				} else if (r.releaseCount === 3) {
					self.buttonPressHandler(r, "TRIPPLE_RELEASE");
				} else if (r.releaseCount === 4) {
					self.buttonPressHandler(r, "LONG_RELEASE");
				} else {
					self.clearAlert(r);
				} 
			}
			
		};
	},
	
	/**
	 * The triggerAlert function initiates the Long Press Alert for the given resource
	 * 
	 * @param r (object) The resource object
	 */
	triggerAlert: function(r) {
		var self = this;
		if (!axis.isNull(r.longPressAlert)) {
			var payload = { message: r.longPressAlert.message };
			if (!axis.isNull(r.longPressAlert.title)) { payload.title = r.longPressAlert.title; }
			if (!axis.isNull(r.longPressAlert.imageFA)) { payload.imageFA = r.longPressAlert.imageFA; }
			r.longPressAlertIsActive = true;
			self.sendSocketNotification("NOTIFY", { notification: "SHOW_ALERT", payload: payload });
		}
	},
	
	/**
	 * The clearAlert function clears the Long Press Alert for the given resource (if it is active)
	 * 
	 * @param r (object) The resource object
	 */
	clearAlert: function(r) {
		var self = this;
		if (r.longPressAlertIsActive) {
			r.longPressAlertIsActive = false;
			self.sendSocketNotification("NOTIFY", { notification: "HIDE_ALERT" });
		}
	},
	
	/**
	 * The buttonPressHandler function triggers actions associated to button presses
	 * 
	 * @param r (object) The resource object
	 * @param actionName (string) The type of the action being triggered
	 */
	buttonPressHandler: function(r, actionName) {
		var self = this;
		var i, payload;
		
		if (self.developerMode) { console.log(self.name + ": buttonPressHandler(): Button \"" + r.name + "\"  Action: \"" + actionName + "\""); }
		
		if ((actionName === "LONG_PRESS" && !r.clearAlertOnRelease) || (actionName === "LONG_RELEASE" && r.clearAlertOnRelease)) {
			self.clearAlert(r);
		}
		
		var actions = r[actionName];
		for (i = 0; i < actions.length; i++) {
			payload = actions[i];
			if (payload.action === "NOTIFY") {
				self.sendSocketNotification("NOTIFY", payload);
			} else {
				self.actionHandler(payload);
			}
		}
	},
	
	/**
	 * The actionHandler function handles led actions received from various sources
	 * 
	 * @param payload (object) Contains the action parameters { action: "", name: "" }
	 * @return (boolean) returns true if a valid action was requested, false otherwise
	 */
	actionHandler: function(payload) {
		var self = this;
		var r, objectType, triggerAction;
		
		if (self.developerMode) { console.log(self.name + ": actionHandler(): " + JSON.stringify(payload)); }
		
		if (!axis.isString(payload.action)) { return false; }
		payload.action = payload.action.toUpperCase();
		
		if (payload.action.indexOf("_SCENE") >= 0) {
			r = self.scenes[payload.name];
			objectType = "scene";
		} else {
			r = self.resources[payload.name];
			objectType = "resource";
		}
		
		if (axis.isUndefined(r)) {
			 console.log(self.name + ": actionHandler(): There is no " + objectType + " assigned to the name: \"" + payload.name + "\"." );
			 return false;
		}
		
		if (r.type === "LED") {
			self.clearAnimation(r);
			switch (payload.action) {
				case "SET": triggerAction = function() { self.setLED(r, payload.value, payload.masterValue, payload.time); }; break;
				case "INCREASE": triggerAction = function() { self.increaseLED(r, payload.value, payload.time); }; break;
				case "DECREASE": triggerAction = function() { self.decreaseLED(r, payload.value, payload.time); }; break;
				case "TOGGLE": triggerAction = function() { self.toggleLED(r, payload.value, payload.masterValue, payload.time); }; break;
				case "BLINK": triggerAction = function() { self.blinkLED(r, payload.time, payload.offTime, payload.value, payload.masterValue); }; break;
				default: return false;
			}
		} else if (r.type === "OUT") {
			self.clearAnimation(r);
			switch (payload.action) {
				case "SET": triggerAction = function() { self.setOUT(r, payload.value); }; break;
				case "TOGGLE": triggerAction = function() { self.toggleOUT(r, payload.value); }; break;
				case "BLINK": triggerAction = function() { self.blinkOUT(r, payload.time, payload.offTime, payload.value); }; break;
				default: return false;
			}
		} else if (r.type === "SCN") {
			switch (payload.action) {
				case "SET_SCENE": triggerAction = function() { self.setSCN(r, payload.value, payload.time); }; break;
				case "INCREASE_SCENE": triggerAction = function() { self.increaseSCN(r, payload.value, payload.time); }; break;
				case "DECREASE_SCENE": triggerAction = function() { self.decreaseSCN(r, payload.value, payload.time); }; break;
				case "TOGGLE_SCENE": triggerAction = function() { self.toggleSCN(r, payload.value, payload.time); }; break;
				default: return false;
			}
		} else {
			return false;
		}
		
		if (axis.isString(payload.delay)) { payload.delay = Number(payload.delay); }
		if (axis.isNumber(payload.delay) && !isNaN(payload.delay) && payload.delay > 0) {
			setTimeout(triggerAction, payload.delay);
		} else {
			triggerAction();
		}
		
		return true;
	},
	
	/**
	 * The getHandler function handles 'get' requests sent via a browser
	 * 
	 * @param req (object) Contains the request data
	 * @param res (object) Contains the response data
	 */
	getHandler: function(req, res) {
		var self = this;
		var output, i;
		var payload = url.parse(req.url, true).query;
		
		if (self.developerMode) { console.log(self.name + ": getHandler(): " + JSON.stringify(payload)); }
		
		if (!axis.isString(payload.action)) {
			res.send(JSON.stringify({ error: true, message: "Unable to proceed.  Please provide an action." }));
		}
		
		payload.action = payload.action.toUpperCase();
		
		var type = payload.action.indexOf("_SCENE") >= 0 ? "scene" : "resource";
		
		if (type === "scene" && axis.isUndefined(self.scenes[payload.name])) {
			res.send(JSON.stringify({ error: true, message: "There is no scene assigned to the name: \"" + payload.name + "\"." }));
		} else if (type === "resource" && axis.isUndefined(self.resources[payload.name])) {
			res.send(JSON.stringify({ error: true, message: "There is no resource assigned to the name: \"" + payload.name + "\"." }));
		} else {
			if (payload.action === "GET_ALL") {
				var data = [];
				var resourceList = Object.values(self.resources);
				var sceneList = Object.values(self.scenes);
				for (i = 0; i < resourceList.length; i++) { data.push(resourceList[i]); }
				for (i = 0; i < sceneList.length; i++) { data.push(sceneList[i]); }
				output = Object.assign({ error: false }, { data: data });
				res.send(JSON.stringify(output));
			} else if (payload.action === "GET" || payload.action === "GET_SCENE" || self.actionHandler(payload)) {
				if (type === "scene") {
					output = Object.assign({ error: false }, { data: self.scenes[payload.name] });
				} else if (type === "resource") {
					output = Object.assign({ error: false }, { data: self.resources[payload.name] });
				}
				res.send(JSON.stringify(output));
			} else {
				res.send(JSON.stringify({ error: true, message: "The action \"" + payload.action + "\" is not valid." }));
			}
		}
	},
	
	/**
	 * Initiate the scene
	 * 
	 * @param s (object) The scene object
	 * @param value (number) The relative value to assign to the specified LED resources in the scene
	 * @param time (number) The duration of the change in milliseconds using a fade effect
	 */
	setSCN: function(s, value, time) {
		var self = this;
		if (!self.initializedOnOff && !self.initializedLED) { return; }
		if (axis.isString(value)) { value = Number(value); }
		if (self.developerMode) { console.log(self.name + ": setSCN(): Name: \"" + s.name + "\"" + value + "\" time: \"" + time + "\""); }
		
		if (axis.isNumber(value) && !isNaN(value)) {
			if (value > 1) { value = 1; } else if (value < 0) { value = 0; }
		} else {
			value = s.default;
		}
		
		s.value = value;
		
		for (var i = 0; i < s.actions.length; i++) {
			var action = Object.assign({}, s.actions[i]);
			action.masterValue = value;
			if (action.action.toUpperCase() !== "BLINK") { action.time = time; }
			self.actionHandler(action);
		}
	},
	
	/**
	 * Increase the value of the scene
	 * 
	 * @param s (object) The scene object
	 * @param value (number) The value to increase the scene by
	 * @param time (number) The duration of the change in milliseconds using a fade effect
	 */
	increaseSCN: function(s, value, time) {
		var self = this;
		if (!self.initializedOnOff && !self.initializedLED) { return; }
		if (axis.isString(value)) { value = Number(value); }
		if (!axis.isNumber(value) || isNaN(value)) { value = 0.1; }
		
		if (self.developerMode) { console.log(self.name + ": increaseSCN(): Name: \"" + s.name + "\"" + value + "\" time: \"" + time + "\""); }
		
		self.setSCN(s, s.value + value, time);
	},
	
	/**
	 * Decrease the value of the scene
	 * 
	 * @param s (object) The scene object
	 * @param value (number) The value to decrease the scene by
	 * @param time (number) The duration of the change in milliseconds using a fade effect
	 */
	decreaseSCN: function(s, value, time) {
		var self = this;
		if (!self.initializedOnOff && !self.initializedLED) { return; }
		if (axis.isString(value)) { value = Number(value); }
		if (!axis.isNumber(value) || isNaN(value)) { value = 0.1; }
		
		if (self.developerMode) { console.log(self.name + ": decreaseSCN(): Name: \"" + s.name + "\"" + value + "\" time: \"" + time + "\""); }
		
		self.setSCN(s, s.value - value, time);
	},
	
	/**
	 * Toggle the scene on and off, using the last value as its on level
	 * 
	 * @param s (object) The scene object
	 * @param value (number) The brightness value use when turning the Scene on.  The previously used value (or 1) will be used if this is not provided.
	 * @param time (number) The duration of the change in milliseconds using a fade effect
	 */
	toggleSCN: function(s, value, time) {
		var self = this;
		if (!self.initializedOnOff && !self.initializedLED) { return; }
		if (axis.isString(value)) { value = Number(value); }
		if (!axis.isNumber(value) || isNaN(value) || value <= 0 || value > 1) { value = null; }
		if (self.developerMode) { console.log(self.name + ": toggleSCN(): Name: \"" + s.name + "\"" + value + "\" time: \"" + time + "\""); }
		
		if (s.value === 0) {
			if (!axis.isNull(value)) { self.setSCN(s, value, time); }
			else if (axis.isUndefined(s.toggleValue)) { self.setSCN(s, 1, time); }
			else { self.setSCN(s, s.toggleValue, time); }
		} else {
			s.toggleValue = s.value;
			self.setSCN(s, 0, time);
		}
	},
	
	/**
	 * The clearAnimation function clears any animation that might be runnig on a given resource.
	 * 
	 * @param r (object) The resource object
	 */
	clearAnimation: function(r) {
		var self = this;
		if (axis.isObject(r)) {
			clearTimeout(self.animations[r.name]);
			clearInterval(self.animations[r.name]);
			delete self.animations[r.name];
		}
	},
	
	/**
	 * The setOUT function sets the output value of a given resource.
	 * 
	 * @param r (object) The resource object
	 * @param value (number) The value to assign to the specified resource
	 */
	setOUT: function(r, value) {
		var self = this;
		if (axis.isString(value)) { value = Number(value); }
		if (!self.initializedOnOff || (value !== 0 && value !== 1)) { return; }
		if (self.developerMode) { console.log(self.name + ": setOUT(): Name: \"" + r.name + "\" Pin: \"" + r.pin + "\" value: \"" + value + "\""); }
		var actualValue = value;
		if (r.activeLow) { actualValue = value === 0 ? 1 : 0; }
		
		self.onoff[r.name].write(actualValue, function(err) {
			if (!err) {
				r.value = value;
			} else if (self.developerMode) {
				console.log(self.name + ": setOUT(): Unable to set resource \"" + r.name + "\" to value \"" + value + "\".  Error: \"" + JSON.stringify(err) + "\"");
			}
		});
	},
	
	/**
	 * The toggleOUT function toggles the output on and off
	 * 
	 * @param r (object) The resource object
	 */
	toggleOUT: function(r) {
		var self = this;
		if (!self.initializedOnOff) { return; }
		if (self.developerMode) { console.log(self.name + ": toggleOUT(): Name: \"" + r.name + "\"."); }
		self.setOUT(r, (r.value === 0 ? 1 : 0));
	},
	
	/**
	 * The blinkOUT function toggles the output on and off
	 * 
	 * @param r (object) The resource object
	 * @param time (number) The number of milliseconds to keep the output 'on'
	 * @param offTime (number) The number of milliseconds to keep the output 'off'.  The time parameter is used if this is not provided.
	 */
	blinkOUT: function(r, time, offTime) {
		var self = this;
		if (!self.initializedOnOff) { return; }
		if (axis.isString(time)) { time = Number(time); }
		if (axis.isString(offTime)) { offTime = Number(offTime); }
		if (!axis.isNumber(time) || isNaN(time) || time <= 0) { time = 750; }
		if (!axis.isNumber(offTime) || isNaN(offTime) || offTime <= 0) { offTime = time; }
		var value = r.value === 0 ? 1 : 0;
		
		if (self.developerMode) { console.log(self.name + ": blinkOUT(): Name: \"" + r.name + "\" time: \"" + time + "\" offTime: \"" + offTime + "\""); }
		
		var blink;
		
		blink = function() {
			var blinkTime = offTime;
			if (r.value === 0) { blinkTime = time; }
			self.toggleOUT(r, value);
			self.animations[r.name] = setTimeout(function(){ blink(); }, blinkTime);
		};
		
		blink();
	},
	
	/**
	 * The setLED function sets the output value of an LED on a given pin.
	 * 
	 * @param r (object) The resource object
	 * @param value (number) The value to assign to the specified resource
	 * @param masterValue (number) Ther percentage of the given value to be set
	 * @param time (number) The duration of the change in milliseconds using a fade effect
	 */
	setLED: function(r, value, masterValue, time) {
		var self = this;
		if (axis.isString(value)) { value = Number(value); }
		if (axis.isString(time)) { time = Number(time); }
		if (axis.isString(masterValue)) { masterValue = Number(masterValue); }
		if (!self.initializedLED || !axis.isNumber(value) || isNaN(value)) { return; }
		if (value > 1) { value = 1; } else if (value < 0) { value = 0; }
		if (isNaN(time) || time <= 15) { time = 0; }
		if (axis.isNumber(masterValue) && !isNaN(masterValue)) {
			if (masterValue > 1) { masterValue = 1; } else if (masterValue < 0) { masterValue = 0; }
			value = value * masterValue;
		}
		if (value === r.value) { return; }
		
		if (self.developerMode) { console.log(self.name + ": setLED(): Name: \"" + r.name + "\" Pin: \"" + r.pin + "\" value: \"" + value + "\" time: \"" + time + "\" masterValue: \"" + masterValue + "\""); }
		
		if (time === 0) {
			
			r.value = value;
			if (r.activeLow) { value = 1 - value; }
			piBlaster.setPwm(r.pin, value);
			
		} else {
			
			var isDecreasing = value < r.value ? true : false;
			var stepTime = 15;
			var numSteps = Math.ceil(time / stepTime);
			var valueChange = Math.abs(value - r.value);
			var stepSize = valueChange / numSteps;
			if (stepSize < 0.0005) {
				stepSize = 0.0005;
				numSteps = Math.ceil(valueChange / stepSize);
				stepTime = Math.round(time / numSteps);
			}

			if (self.developerMode) { console.log(self.name + ":  -->  stepTime: \"" + stepTime + "\" stepSize: \"" + stepSize + "\" numSteps: \"" + numSteps + "\""); }

			self.animations[r.name] = setInterval(function(){
				var newValue = r.value + stepSize;
				if (isDecreasing) {
					newValue = r.value - stepSize;
					if (newValue < value) { newValue = value; }
				} else {
					if (newValue > value) { newValue = value; }
				}
				
				r.value = newValue;
				if (r.activeLow) { newValue = 1 - newValue; }
				piBlaster.setPwm(r.pin, newValue);
				
				if (newValue === value) { clearInterval(self.animations[r.name]); }
			}, stepTime);
			
		}
	},
	
	/**
	 * The increaseLED function increases the value by the given amount
	 * 
	 * @param r (object) The resource object
	 * @param value (number) The value to increase the resource by
	 * @param time (number) The duration of the change in milliseconds using a fade effect
	 */
	increaseLED: function(r, value, time) {
		var self = this;
		if (axis.isString(value)) { value = Number(value); }
		if (!self.initializedLED) { return; }
		if (!axis.isNumber(value) || isNaN(value)) { value = 0.1; }
		
		if (self.developerMode) { console.log(self.name + ": increaseLED(): Name: \"" + r.name + "\" value: \"" + value + "\" time: \"" + time + "\""); }
		
		self.setLED(r, r.value + value, null, time);
	},
	
	/**
	 * The decreaseLED function decreases the value by the given amount
	 * 
	 * @param r (object) The resource object
	 * @param value (number) The value to decrease the resource by
	 * @param time (number) The duration of the change in milliseconds using a fade effect
	 */
	decreaseLED: function(r, value, time) {
		var self = this;
		if (axis.isString(value)) { value = Number(value); }
		if (!self.initializedLED) { return; }
		if (!axis.isNumber(value) || isNaN(value)) { value = 0.1; }
		
		if (self.developerMode) { console.log(self.name + ": decreaseLED(): Name: \"" + r.name + "\" value: \"" + value + "\" time: \"" + time + "\""); }
		
		self.setLED(r, r.value - value, null, time);
	},
	
	/**
	 * The toggleLED function toggles the LED on and off, using the last value as its on level
	 * 
	 * @param r (object) The resource object
	 * @param value (number) The brightness value use when turning the LED on.  The previously used value (or 1) will be used if this is not provided.
	 * @param masterValue (number) Ther percentage of the given value to be set
	 * @param time (number) The duration of the change in milliseconds using a fade effect
	 */
	toggleLED: function(r, value, masterValue, time) {
		var self = this;
		if (!self.initializedLED) { return; }
		if (axis.isString(value)) { value = Number(value); }
		if (!axis.isNumber(value) || isNaN(value) || value <= 0 || value > 1) { value = null; }
		if (self.developerMode) { console.log(self.name + ": toggleLED(): Name: \"" + r.name + "\" value: \"" + value + "\" time: \"" + time + "\""); }
		
		if (r.value === 0) {
			if (!axis.isNull(value)) { self.setLED(r, value, masterValue, time); }
			else if (axis.isUndefined(r.toggleValue)) { self.setLED(r, 1, masterValue, time); }
			else { self.setLED(r, r.toggleValue, masterValue, time); }
		} else {
			r.toggleValue = r.value;
			self.setLED(r, 0, null, time);
		}
	},
	
	/**
	 * The blinkLED function toggles the LED on and off, using the last value as its on level
	 * 
	 * @param r (object) The resource object
	 * @param time (number) The number of milliseconds to keep the output 'on'
	 * @param offTime (number) The number of milliseconds to keep the output 'off'.  The time parameter is used if this is not provided.
	 * @param value (number) The brightness value to use for the 'on' duration
	 * @param masterValue (number) Ther percentage of the given value to be set
	 */
	blinkLED: function(r, time, offTime, value, masterValue) {
		var self = this;
		if (!self.initializedLED) { return; }
		if (axis.isString(time)) { time = Number(time); }
		if (axis.isString(offTime)) { offTime = Number(offTime); }
		if (axis.isString(value)) { value = Number(value); }
		if (!axis.isNumber(time) || isNaN(time) || time <= 0) { time = 750; }
		if (!axis.isNumber(offTime) || isNaN(offTime) || offTime <= 0) { offTime = time; }
		if (!axis.isNumber(value) || isNaN(value) || value <= 0 || value > 1) { value = null; }
		if (self.developerMode) { console.log(self.name + ": blinkLED(): Name: \"" + r.name + "\" value: \"" + value + "\" time: \"" + time + "\" offTime: \"" + offTime + "\""); }
		
		var blink;
		
		blink = function() {
			var blinkTime = offTime;
			if (r.value === 0) { blinkTime = time; }
			self.toggleLED(r, value, masterValue);
			self.animations[r.name] = setTimeout(function(){ blink(); }, blinkTime);
		};
		
		blink();
	},
	
	/**
	 * The stop function releases any resources in use when the application exits.
	 */
	stop: function() {
		var self = this;
		console.log(self.name + ": Stopping module helper. ");
		// Stop the pi-blaster instance(s) that is/are running
		if (self.initializedLED) {
			exec("sudo pkill " + self.processName, { timeout: 1500 }, function(error, stdout, stderr) { });
		}
		var resourceList = Object.values(self.resources);
		for (var i = 0; i < resourceList.length; i++) {
			var r = resourceList[i];
			if (r.type === "LED") {
				//if (!axis.isNull(r.exitValue)) { self.setLED(r.name, r.exitValue); }
			} else if (r.type === "OUT") {
				if (self.developerMode) { console.log(self.name + ": stop(): Releasing resource (Output): \"" + r.name + "\" pin: \"" + r.pin + "\". "); }
				self.onoff[r.name].unexport();
			} else if (r.type === "BTN" && !axis.isUndefined(self.onoff[r.name])) {
				if (self.developerMode) { console.log(self.name + ": stop(): Releasing resource (Button): \"" + r.name + "\" pin: \"" + r.pin + "\". "); }
				self.onoff[r.name].unexport();
			}
		}
	}
	
});
