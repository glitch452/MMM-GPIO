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
		pinScheme: "BCMv2",
		debounceTimeout: 10,
		scriptPath: null, // Set in self.start() becuase access to self.data.path is needed
		
		developerMode: false,
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
		var i, resource, pin;
		self.instanceID = self.identifier + "_" + Math.random().toString().substring(2);
		self.defaults.scriptPath = self.data.path + "pi-blaster";
		self.resources = {};
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
		
		if (!axis.isString(self.config.scriptPath) || self.config.scriptPath.length < 1 ) { self.config.scriptPath = self.defaults.scriptPath; }
		if (!axis.isArray(self.config.leds)) { self.config.leds = self.defaults.leds; }
		if (!self.validPinSchemes.includes(self.config.pinScheme)) { self.config.pinScheme = self.defaults.pinScheme; }
		if (!axis.isBoolean(self.config.developerMode)) { self.config.developerMode = self.defaults.developerMode; }
		if (!axis.isNumber(self.config.debounceTimeout) || isNaN(self.config.debounceTimeout) || self.config.debounceTimeout < 1 ) { self.config.debounceTimeout = self.defaults.debounceTimeout; }
		
		// Loop through the provided configurations and add valid ones to the resources
		for (i = 0; i < self.config.leds.length; i++) { self.addResource("LED", self.config.leds[i]); }
		for (i = 0; i < self.config.outputs.length; i++) { self.addResource("OUT", self.config.outputs[i]); }
		for (i = 0; i < self.config.buttons.length; i++) { self.addResource("BTN", self.config.buttons[i]); }
		
		self.log(("start(): self.data: " + JSON.stringify(self.data)), "dev");
		self.log(("start(): self.config: " + JSON.stringify(self.config)), "dev");
		
		self.sendSocketNotification("INIT", {
			instanceID: self.instanceID,
			scriptPath: self.config.scriptPath,
			debounceTimeout: self.config.debounceTimeout,
			resources: self.resources,
			developerMode: self.config.developerMode
		});
		
	},
	
	/**
	 * Validate the provided pin number against the pinMapping list
	 * 
	 * @param type (string) The type of resource
	 * @param resource (object) The resource to validate
	 */
	addResource: function(type, resource) {
		var self = this;
		var pin, typeFull;
		
		switch (type) {
			case "LED": typeFull = "LED"; break;
			case "OUT": typeFull = "Output"; break;
			case "BTN": typeFull = "Button"; break;
			default: typeFull = "Unknown Type";
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
		
		var result = { name: resource.name, pin: resource.pin };
		
		if (type === "LED") {
			result.type = "LED";
			
			if (!axis.isNumber(resource.value) || isNaN(resource.value)) { resource.value = 0; }
			else if (resource.value < 0) { resource.value = 0; }
			else if (resource.value > 1) { resource.value = 1; }
			
			if (!axis.isNumber(resource.exitValue) || isNaN(resource.exitValue)) { resource.exitValue = null; }
			else if (resource.exitValue < 0) { resource.exitValue = 0; }
			else if (resource.exitValue > 1) { resource.exitValue = 1; }
			
			if (!axis.isBoolean(resource.activeLow)) { resource.activeLow = false; }
			
			result.value = resource.value;
			result.exitValue = resource.exitValue;
			result.activeLow = resource.activeLow;
		} else if (type === "OUT") {
			result.type = "OUT";
			
			if (resource.value !== 0 && resource.value !== 1) { resource.value = 0; }
			if (!axis.isBoolean(resource.activeLow)) { resource.activeLow = false; }
			
			result.value = resource.value;
			result.activeLow = resource.activeLow;
		} else if (type === "BTN") {
			result.type = "BTN";
			
			if (!axis.isBoolean(resource.activeLow)) { resource.activeLow = false; }
			
			result.activeLow = resource.activeLow;
		}
		
		self.pinList.push(resource.pin);
		self.nameList.push(resource.name);
		self.resources[resource.name] =  result;
		
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
		if (!axis.isString(payload.original.instanceID)) {
			if (notification === "LOG") {
				if (payload.translate) { self.log(self.translate(payload.message, payload.translateVars), payload.logType); }
				else { self.log(payload.message, payload.logType); }
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
	 * Override the getDom function to generate the DOM objects to be displayed for this module instance
	 */
	getDom: function() {
		
		return null;
		
	},
	
	/**
	 * The roundNumber function rounds a number to the specified number of decimal places.  
	 * Use a negative precision value to round to a position left of the decimal.  
	 * This function overcomes the floating-point rounding issues and rounds away from 0.  
	 * 
	 * @param number (number) The number to round
	 * @param precision (number) The position to round to before or after the decimal
	 * @return (number) The rounded number
	 */
	roundNumber: function(number, precision) {
        if (precision >= 0) { return Number(Math.round(number + "e" + precision) + "e-" + precision); }
    	else { return Number(Math.round(number + "e-" + Math.abs(precision)) + "e" + Math.abs(precision)); }
    },
	
	/**
	 * The replaceAll function replaces all occurrences of a string within the given string. 
	 * 
	 * @param str (string) The string to search within
	 * @param find (string) The string to find within str
	 * @param replace (string) The string to use as a replacement for the find string
	 * @return (string) A copy of str with all the find occurrences replaced with replace
	 */
	replaceAll: function(str, find, replace) {
		var output = "";
		var idx = str.indexOf(find);
		while (idx >= 0) {
			output += str.substr(0, idx) + replace;
			str = str.substring(idx + find.length);
			idx = str.indexOf(find);
		}
		output += str;
		return output;
	},
	
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
	 */
	getStyles: function () {
		return [];
	},
	
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
