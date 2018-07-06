/* global Module */

/**
 * Magic Mirror
 * Module: MMM-GPIO
 *
 * By David Dearden
 * MIT Licensed.
 */

var axis, Log;

/**
 * Register the module with the MagicMirror program
 */
Module.register("MMM-GPIO", {
	
	/**
	 * The default configuration options
	 */
	defaults: {
		leds: [],
		buttons: [],
		outputs: [],
		scenes: [],
		animations: [],
		triggers: [],
		pinScheme: "BCMv2",
		activeLow: false,
		debounceTimeout: 8,
		multiPressTimeout: 325,
		longPressTime: 4000,
		clearAlertOnRelease: false,
		scriptPath: null, // Set in self.start() becuase access to self.data.path is needed
		
		developerMode: false
	},
	
	/**
	 * The minimum version of magic mirror that is required for this module to run. 
	 */
	requiresVersion: "2.2.1",
	
	/**
	 * Override the start function.  Set some instance variables and validate the selected 
	 * configuration options before loading the rest of the module.  
	 */
	start: function() {
		var self = this;
		var i;
		self.instanceID = self.identifier + "_" + Math.random().toString().substring(2);
		self.defaults.scriptPath = self.data.path + "pi-blaster";
		self.resources = {};
		self.scenes = {};
		self.animations = {};
		self.triggers = {};
		self.pinList = [];
		self.nameList = [];
		self.validPinSchemes = [ "BCMv1", "BCMv2" ];
		self.pinMapping = [
			{ "BOARD": 10, "BCMv1": 15, "BCMv2": 15, "WPI": 16 },
			{ "BOARD": 11, "BCMv1": 17, "BCMv2": 17, "WPI": 0 },
			{ "BOARD": 12, "BCMv1": 18, "BCMv2": 18, "WPI": 1 },
			{ "BOARD": 13, "BCMv1": 21, "BCMv2": 27, "WPI": 2 },
			{ "BOARD": 15, "BCMv1": 22, "BCMv2": 22, "WPI": 3 },
			{ "BOARD": 16, "BCMv1": 23, "BCMv2": 23, "WPI": 4 },
			{ "BOARD": 18, "BCMv1": 24, "BCMv2": 24, "WPI": 5 },
			{ "BOARD": 19, "BCMv1": 10, "BCMv2": 10, "WPI": 12 },
			{ "BOARD": 21, "BCMv1": 9, "BCMv2": 9, "WPI": 13 },
			{ "BOARD": 22, "BCMv1": 25, "BCMv2": 25, "WPI": 6 },
			{ "BOARD": 23, "BCMv1": 11, "BCMv2": 11, "WPI": 14 },
			{ "BOARD": 24, "BCMv1": 8, "BCMv2": 8, "WPI": 10 },
			{ "BOARD": 26, "BCMv1": 7, "BCMv2": 7, "WPI": 11 },
			{ "BOARD": 29, "BCMv1": null, "BCMv2": 5, "WPI": 21 },
			{ "BOARD": 3, "BCMv1": 0, "BCMv2": 2, "WPI": 8 },
			{ "BOARD": 31, "BCMv1": null, "BCMv2": 6, "WPI": 22 }, // GPIO 6 is banned in PiBlaster becuase it is used for ethernet on some boards
			{ "BOARD": 32, "BCMv1": null, "BCMv2": 12, "WPI": 26 },
			{ "BOARD": 33, "BCMv1": null, "BCMv2": 13, "WPI": 23 },
			{ "BOARD": 35, "BCMv1": null, "BCMv2": 19, "WPI": 24 },
			{ "BOARD": 36, "BCMv1": null, "BCMv2": 16, "WPI": 27 },
			{ "BOARD": 37, "BCMv1": null, "BCMv2": 26, "WPI": 25 },
			{ "BOARD": 38, "BCMv1": null, "BCMv2": 20, "WPI": 28 },
			{ "BOARD": 40, "BCMv1": null, "BCMv2": 21, "WPI": 29 },
			{ "BOARD": 5, "BCMv1": 1, "BCMv2": 3, "WPI": 9 },
			{ "BOARD": 7, "BCMv1": 4, "BCMv2": 4, "WPI": 7 },
			{ "BOARD": 8, "BCMv1": 14, "BCMv2": 14, "WPI": 15 }
		];
		self.triggerActionMapping = {
			onPress: "PRESS",
			onRelease: "RELEASE",
			onDoublePress: "DOUBLE_PRESS",
			onDoubleRelease: "DOUBLE_RELEASE",
			onTripplePress: "TRIPPLE_PRESS",
			onTrippleRelease: "TRIPPLE_RELEASE",
			onLongPress: "LONG_PRESS",
			onLongRelease: "LONG_RELEASE",
		};
		self.validTriggers = Object.keys(self.triggerActionMapping);
		
		if (!axis.isString(self.config.scriptPath) || self.config.scriptPath.length < 1 ) { self.config.scriptPath = self.defaults.scriptPath; }
		if (!axis.isArray(self.config.leds)) { self.config.leds = self.defaults.leds; }
		if (!self.validPinSchemes.includes(self.config.pinScheme)) { self.config.pinScheme = self.defaults.pinScheme; }
		if (!axis.isBoolean(self.config.developerMode)) { self.config.developerMode = self.defaults.developerMode; }
		if (!axis.isBoolean(self.config.activeLow)) { self.config.activeLow = self.defaults.activeLow; }
		if (!axis.isBoolean(self.config.clearAlertOnRelease)) { self.config.clearAlertOnRelease = self.defaults.clearAlertOnRelease; }
		if (!axis.isNumber(self.config.debounceTimeout) || isNaN(self.config.debounceTimeout) || self.config.debounceTimeout < 0 ) { self.config.debounceTimeout = self.defaults.debounceTimeout; }
		if (!axis.isNumber(self.config.multiPressTimeout) || isNaN(self.config.multiPressTimeout) || self.config.multiPressTimeout < 0 ) { self.config.multiPressTimeout = self.defaults.multiPressTimeout; }
		if (!axis.isNumber(self.config.longPressTime) || isNaN(self.config.longPressTime) || self.config.longPressTime < 0 ) { self.config.longPressTime = self.defaults.longPressTime; }
		
		if (!axis.isArray(self.config.leds)) { self.config.leds = [ self.config.leds ]; }
		if (!axis.isArray(self.config.outputs)) { self.config.outputs = [ self.config.outputs ]; }
		if (!axis.isArray(self.config.buttons)) { self.config.buttons = [ self.config.buttons ]; }
		if (!axis.isArray(self.config.scenes)) { self.config.scenes = [ self.config.scenes ]; }
		if (!axis.isArray(self.config.animations)) { self.config.animations = [ self.config.animations ]; }
		
		// Loop through the provided configurations and add valid ones to the resources
		for (i = 0; i < self.config.leds.length; i++) { self.addResource("LED", self.config.leds[i]); }
		for (i = 0; i < self.config.outputs.length; i++) { self.addResource("OUT", self.config.outputs[i]); }
		for (i = 0; i < self.config.buttons.length; i++) { self.addResource("BTN", self.config.buttons[i]); }
		// Add the scenes
		for (i = 0; i < self.config.scenes.length; i++) { self.addScene(self.config.scenes[i]); }
		// Add the animations
		for (i = 0; i < self.config.animations.length; i++) { self.addAnimation(self.config.animations[i]); }
		// Add the triggers
		for (i = 0; i < self.config.triggers.length; i++) { self.addTrigger(self.config.triggers[i]); }
		
		self.log(("start(): self.data: " + JSON.stringify(self.data)), "dev");
		self.log(("start(): self.config: " + JSON.stringify(self.config)), "dev");
		self.log(("start(): self.resources: " + JSON.stringify(self.resources)), "dev");
		self.log(("start(): self.scenes: " + JSON.stringify(self.scenes)), "dev");
		self.log(("start(): self.animations: " + JSON.stringify(self.animations)), "dev");
		self.log(("start(): self.triggers: " + JSON.stringify(self.triggers)), "dev");
		
		self.sendSocketNotification("INIT", {
			instanceID: self.instanceID,
			scriptPath: self.config.scriptPath,
			resources: self.resources,
			scenes: self.scenes,
			animations: self.animations,
			developerMode: self.config.developerMode
		});
		
	},
	
	/**
	 * Validate the resource and add it to the resources list
	 * 
	 * @param type (string) The type of resource
	 * @param resource (object) The resource to validate
	 */
	addResource: function(type, resource) {
		var self = this;
		var i, pin, typeFull, triggerName, actionName;
		
		switch (type) {
			case "LED": typeFull = "LED"; break;
			case "OUT": typeFull = "Output"; break;
			case "BTN": typeFull = "Button"; break;
			default: return;
		}
		
		if (!axis.isString(resource.name) || resource.name.length < 1) {
			self.log(("A name has not been provided.  The " + typeFull + " on pin " + resource.pin + " cannot be initialized. "), "warn");
			return;
		}
		
		if (self.nameList.includes(resource.name)) {
			self.log(("The name \"" + resource.name + "\" is already assigned.  The " + typeFull + " on pin " + resource.pin + " cannot be initialized. "), "warn");
			return;
		}
		
		pin = resource.pin;
		resource.pin = self.validatePin(resource.pin);
		if (axis.isNull(resource.pin) || (type === "LED" && pin === 6)) {
			self.log(("Invalid pin number provided (" + pin + ").  The " + typeFull + " \"" + resource.name + "\" cannot be initialized. "), "warn");
			return;
		}
		
		if (self.pinList.includes(resource.pin)) {
			self.log(("The pin number provided (" + pin + ") is already in use.  The " + typeFull + " \"" + resource.name + "\"cannot be initialized. "), "warn");
			return;
		}
		
		if (!axis.isBoolean(resource.activeLow)) { resource.activeLow = self.config.activeLow; }
		
		var result = { type: type, name: resource.name, pin: resource.pin, activeLow: resource.activeLow };
		
		if (type === "LED") {
			if (!axis.isNumber(resource.value) || isNaN(resource.value)) { resource.value = 0; }
			else if (resource.value < 0) { resource.value = 0; }
			else if (resource.value > 1) { resource.value = 1; }
			
			if (!axis.isNumber(resource.exitValue) || isNaN(resource.exitValue)) { resource.exitValue = null; }
			else if (resource.exitValue < 0) { resource.exitValue = 0; }
			else if (resource.exitValue > 1) { resource.exitValue = 1; }
			
			result.value = resource.value;
			result.exitValue = resource.exitValue;
		} else if (type === "OUT") {
			if (resource.value !== 0 && resource.value !== 1) { resource.value = 0; }
			result.value = resource.value;
		} else if (type === "BTN") {
			if (!axis.isBoolean(resource.clearAlertOnRelease)) { resource.clearAlertOnRelease = self.config.clearAlertOnRelease; }
			if (!axis.isNumber(resource.debounceTimeout) || isNaN(resource.debounceTimeout) || resource.debounceTimeout < 0 ) { resource.debounceTimeout = self.config.debounceTimeout; }
			if (!axis.isNumber(resource.multiPressTimeout) || isNaN(resource.multiPressTimeout) || resource.multiPressTimeout < 0 ) { resource.multiPressTimeout = self.config.multiPressTimeout; }
			if (!axis.isNumber(resource.longPressTime) || isNaN(resource.longPressTime) || resource.longPressTime < 0 ) { resource.longPressTime = self.config.longPressTime; }
			
			if (axis.isObject(resource.longPressAlert) && axis.isString(resource.longPressAlert.message)) {
				result.longPressAlert = { message: resource.longPressAlert.message, title: null, imageFA: null };
				if (axis.isString(resource.longPressAlert.title)) { result.longPressAlert.title = resource.longPressAlert.title; }
				if (axis.isString(resource.longPressAlert.imageFA)) { result.longPressAlert.imageFA = resource.longPressAlert.imageFA; }
			} else {
				result.longPressAlert = null;
			}
			
			for (i = 0; i < self.validTriggers.length; i++) {
				triggerName = self.validTriggers[i];
				actionName = self.triggerActionMapping[triggerName];
				result[actionName] = self.validateActions(resource[triggerName]);
			}
			
			if (result.TRIPPLE_PRESS.length > 0 || result.TRIPPLE_RELEASE.length > 0) { result.numShortPress = 3; }
			else if (result.DOUBLE_PRESS.length > 0 || result.DOUBLE_RELEASE.length > 0) { result.numShortPress = 2; }
			else if (result.PRESS.length > 0 || result.RELEASE.length > 0) { result.numShortPress = 1; }
			else { result.numShortPress = 0; }
			result.enableLongPress = (result.LONG_PRESS.length > 0 || result.LONG_RELEASE.length > 0);
			
			result.clearAlertOnRelease = resource.clearAlertOnRelease;
			result.debounceTimeout = resource.debounceTimeout;
			result.multiPressTimeout = resource.multiPressTimeout;
			result.longPressTime = resource.longPressTime;
		}
		
		self.pinList.push(resource.pin);
		self.nameList.push(resource.name);
		self.resources[resource.name] = result;
		
	},
	
	/**
	 * Validate the provided scene and add it to the scene list
	 * 
	 * @param scene (object) The scene to validate
	 */
	addScene: function(scene) {
		var self = this;
		
		if (!axis.isString(scene.name) || scene.name.length < 1) {
			self.log(("A name has not been provided.  The scene cannot be initialized. "), "warn");
			return;
		}
		
		var result = { type: "SCN", name: scene.name };
		
		result.actions = self.validateActions(scene.actions);
		
		if (result.actions.length < 1) {
			self.log(("No valid actions have been provided.  The scene cannot be initialized. "), "warn");
			return;
		}
		
		if (!axis.isNumber(scene.value) || isNaN(scene.value)) { scene.value = 1; }
		else if (scene.value < 0) { scene.value = 0; }
		else if (scene.value > 1) { scene.value = 1; }
		
		result.default = scene.value;
		result.value = 0;
		self.scenes[scene.name] = result;
	},
	
	/**
	 * Validate the provided animation and add it to the animation list
	 * 
	 * @param animation (object) The animation to validate
	 */
	addAnimation: function(animation) {
		var self = this;
		var i, frame, frame_result;
		
		if (!axis.isString(animation.name) || animation.name.length < 1) {
			self.log(("A name has not been provided.  The animation cannot be initialized. "), "warn");
			return;
		}
		
		var result = { type: "ANI", name: animation.name, frames: [] };
		
		if (!axis.isArray(animation.frames)) { animation.frames = [ animation.frames ]; }
		
		for (i = 0; i < animation.frames.length; i++) {
			frame = animation.frames[i];
			frame_result = { actions: self.validateActions(frame.actions) };
			if (frame_result.actions.length > 0) {
				if (!axis.isNumber(frame.time) || isNaN(frame.time)) { frame.time = 1000; }
				if (frame.time < 0) { frame.time = 0; }
				frame_result.time = frame.time;
				result.frames.push(frame_result);
			}
		}
		
		if (axis.isUndefined(result.frames)) {
			self.log(("No valid frames have been provided.  The animation cannot be initialized. "), "warn");
			return;
		}
		
		result.repeat = animation.repeat === true ? true : false;
		result.running = false;
		result.preStartActions = self.validateActions(animation.preStartActions);
		result.onStopActions = self.validateActions(animation.onStopActions);
		
		self.animations[animation.name] = result;
	},
	
	/**
	 * Validate the provided action(s)
	 * 
	 * @param a (object|array) The action object to validate
	 * @param singleMode (boolean) If true, and 'a' is not an array, a single object is returned, otherwise the object is returned in an array
	 * @return (object|null|array) Returns an array of the given valid action(s).  When in singleMode, returns the action, if valid, otherwise null
	 */
	validateActions: function(a, singleMode) {
		var self = this;
		
		if (axis.isArray(a)) {
			var actions = [];
			for (var i = 0; i < a.length; i++) {
				if (axis.isArray(a[i])) { continue; }
				a[i] = self.validateActions(a[i], true);
				if (!axis.isNull(a[i])) { actions.push(a[i]); }
			}
			return actions;
		}
		
		if (singleMode !== true) { singleMode = false; }
		
		if (!axis.isObject(a) || !axis.isString(a.action) || a.action.length < 1) { return singleMode ? null : []; }
		a.action = a.action.toUpperCase();
		if	(	( a.action !== "STOP_ALL" && a.action !== "NOTIFY" && (!axis.isString(a.name) || a.name.length < 1) ) ||
				( a.action === "NOTIFY" && (!axis.isString(a.notification) || a.notification.length < 1) )
			) { return singleMode ? null : []; }
		
		return singleMode ? a : [ a ];
	},
	
	/**
	 * Validate the provided pin number against the pinMapping list
	 * 
	 * @param pin (number) The pin number to validate
	 * @return (number|null) Returns the pin number, if valid, otherwise null
	 */
	validatePin: function(pin) {
		var self = this;
		var pinObj = self.pinMapping.find(function(val) { return val[this.scheme] === this.pin; }, { scheme: self.config.pinScheme, pin: pin });
		if (axis.isUndefined(pinObj)) {
			return null;
		} else {
			return pinObj[self.config.pinScheme];
		}
	},
	
	/**
	 * Override the socketNotificationReceived function to handle the notifications sent from the node helper
	 * 
	 * @param notification (string) The type of notification sent
	 * @param payload (any) The data sent with the notification
	 */
	socketNotificationReceived: function(notification, payload) {
		var self = this;
		
		// If there is no module ID sent with the notification
		if (!axis.isObject(payload.original) || !axis.isString(payload.original.instanceID)) {
			if (notification === "LOG") {
				if (payload.translate) { self.log(self.translate(payload.message, payload.translateVars), payload.logType); }
				else { self.log(payload.message, payload.logType); }
			} else if (notification === "NOTIFY") {
				self.sendNotification(payload.notification, payload.payload);
			}
			return;
		}
		
		// Filter out notifications for other instances
		if (payload.original.instanceID !== self.instanceID) {
			self.log(("Notification ignored for ID \"" + payload.original.instanceID + "\"."), "dev");
			return;
		}
		
		if (notification === "LOG") {
			if (payload.translate) { self.log(self.translate(payload.message, payload.translateVars), payload.logType); }
			else { self.log(payload.message, payload.logType); }
		}
	},
	
	/**
	 * Override the notificationReceived function.  
	 * For now, there are no actions based on system or module notifications.  
	 * 
	 * @param notification (string) The type of notification sent
	 * @param payload (any) The data sent with the notification
	 * @param sender (object) The module that the notification originated from
	 */
	notificationReceived: function(notification, payload, sender) {
		var self = this;
		if (sender) { // If the notification is coming from another module
			
			self.log(("notificationReceived(): " + notification + " " + JSON.stringify(payload) + " " + sender.name), "dev");
			
			if (notification === "GPIO_ACTION") {
				self.sendSocketNotification(notification, payload);
			}
		}
	},
	
	/**
	 * Override the getDom function to generate the DOM objects to be displayed for this module instance.
	 * Since this module has nothing to display, return an empty text node.
	 */
	getDom: function() { return document.createTextNode(""); },
	
	/**
	 * Override the getScripts function to load additional scripts used by this module. 
	 */
	getScripts: function() {
		var scripts = [];
		if (typeof axis !== "function") { scripts.push(this.file("scripts/axis.js")); }
		return scripts;
	},
	
	/**
	 * Override the getStyles function to load CSS files used by this module. 
	 * Since this module does not display anything, return an empty list. 
	 */
	getStyles: function () { return []; },
	
	/**
	 * Override the getTranslations function to load translation files specific to this module. 
	 */
	getTranslations: function() {
		return {
			en: "translations/en.json",
		};
	},
	
	/**
	 * The log function is a convenience alias that sends a message to the console.  
	 * This is an alias for the MagicMirror Log functions with a developer mode feature added.  
	 * This function prepends the module name to the message.  
	 * 
	 * @param message (string) The message to be sent to the console
	 * @param type (string) The type of message (dev, error, info, log)
	 */
	log: function(message, type) {
		var self = this;
		if (self.config.developerMode) {
			var date = new Date();
			var time = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
			message = self.name + ": (" + self.data.index + ")(" + time + ") " + message;
		} else { message = self.name + ": " + message; }
		switch (type) {
			case "error": Log.error(message); break;
			case "warn": Log.warn(message); break;
			case "info": Log.info(message); break;
			case "dev": if (self.config.developerMode) { Log.log(message); } break;
			default: Log.log(message);
		}
	}
	
});
