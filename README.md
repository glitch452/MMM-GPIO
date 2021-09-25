# MMM-GPIO

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/) smart mirror project.

This module allows control of the GPIO pins on the Raspberry Pi in the form of digital outputs, dimmable LED outputs and Button inputs. 
This module also has the ability to trigger pre-configured scenes and animations. 

| Status       | Version | Date       | Maintained? | Minimum MagicMirror² Version |
|:------------ |:------- |:---------- |:----------- |:---------------------------- |
| Experimental | `0.2.0` | 2020-09-24 | No          |`2.2.1`                       |

### Example
![Rainbow colours animation on an RGB ring LED controlled by MMM-GPIO](images/rainbow.gif?raw=true "LED Animation Example")

A button with an RGB Ring LED running a 'rainbow' animation which fades through the colors of the rainbow. 

### Notable Features
1. Control LED's, Relay's, etc, with GPIO connected outputs
1. Trigger actions or module notifications with GPIO connected buttons
1. Button actions can be assigned to 8 different triggers: press, release, double press, double release, triple press, triple release, long press, and long release
1. LED brightness is controlled by Software PWM (Pulse Width Modulation) using DMA (Direct Memory Access) for zero CPU usage while running
1. Create scenes, which are a set of one or more actions, and trigger them with button presses or notifications
1. Create animations by using sets of actions or existing scenes
1. Create triggers that execute a set of actions when the specified module notification is received
1. Execute actions via notifications from other modules. This module responds to the `"GPIO_ACTION"` notification with the payload being the [Action object](#action-configuration-options).
1. Execute actions via GET or POST requests to /MMM-GPIO/requests

### Notable Limitations
1. The Raspberry Pi's internal Pull-Up and Pull-Down resistors are not supported
1. LED dimming cannot be used on GPIO 6 for some Raspberry Pi models (a pi-blaster restriction)

### Dependencies
1. The '[onoff](https://www.npmjs.com/package/onoff)' node module for buttons and digital outputs (Free to install and use - Installed with this module)
1. The '[Pi-Blaster](https://github.com/sarfata/pi-blaster)' program for LED outputs with dimming (Free to install and use - A copy of it comes with this module)

## Table of Contents
- [MMM-GPIO](#mmm-gpio)
  * [Example](#example)
  * [Notable Features](#notable-features)
  * [Notable Limitations](#notable-limitations)
  * [Dependencies](#dependencies)
- [Table of Contents](#table-of-contents)
- [Installation](#installation)
- [Using the module](#Using-the-module)
  * [MagicMirror² Configuration](#MagicMirror-Configuration)
  * [General Configuration Options](#General-Configuration-Options)
  * [Output Configuration Options](#Output-Configuration-Options)
  * [LED Configuration Options](#LED-Configuration-Options)
  * [Button Configuration Options](#Button-Configuration-Options)
  * [Scene Configuration Options](#Scene-Configuration-Options)
  * [Animation Configuration Options](#Animation-Configuration-Options)
  * [Trigger Configuration Options](#Trigger-Configuration-Options)
  * [Action Configuration Options](#Action-Configuration-Options)
  * [Action List](#Action-List)
- [Wiring Buttons and LED's](#Wiring-Buttons-and-LED-s)
- [Updating the Module](#Updating-the-Module)
- [License](#License)


## Installation
To install the module, use the following terminal commands:
1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
1. Copy the module to your computer:<br />`git clone https://github.com/glitch452/MMM-GPIO.git`
1. Enter the 'MMM-GPIO' directory and Install the node modules:<br />`cd MMM-GPIO && npm install`
1. Make sure the 'Pi-Blaster' program is executable:<br />`chmod +x pi-blaster`

## Using the module

### MagicMirror² Configuration

To use this module, add an 'MMM-GPIO' configuration block to the modules array in the `config/config.js` file.<br />Below is an example of some configuration options.
```js
var config = {
    modules: [
        ...
        {
            module: 'MMM-GPIO',
            config: {
                leds: [
                    { name: "red",   pin: 20, value: 0.233 },
                    { name: "green", pin: 21, value: 0 },
                    { name: "blue",  pin: 22, value: 1 }
                ],
                outputs: [
                    { name: "relay", pin: 18, value: 1 }
                ],
                buttons: [
                    { name: "btn1",  pin: 23,
                        onDoubleRelease: { action: "TOGGLE", name: "red" }
                    },
                    { name: "btn2",  pin: 24, longPressTime: 3000,
                        onRelease: { action: "NOTIFY", notification: "COMMANDS_ACTION", payload: { action: "DISPLAY_TOGGLE" } },
                        onLongPress: { action: "NOTIFY", notification: "COMMANDS_ACTION", payload: { action: "SHUTDOWN" } },
                        longPressAlert: { title: "Shutdown", message: "Hold for 3 seconds to Shut Down the System.", imageFA: "power-off" }
                    },
                ],
                scenes: [
                    { name: "turquoise", actions: [
                        { action: "SET", name: "red", value: 0 },
                        { action: "SET", name: "green", value: 0.65 },
                        { action: "SET", name: "blue", value: 1 }
                    ] }
                ],
                animations: [
                    { name: "slowPulse", repeat: true,
                        preStartActions: [
                            { action: "STOP_ALL" },
                            { action: "SET_SCENE", name: "turquoise", value: 0 }
                        ],
                        onStopActions: { action: "SET_SCENE", name: "turquoise", value: 0 },
                        frames: [
                            { time: 4000, actions: { action: "SET_SCENE", name: "white", value: 1, time: 4000 } },
                            { time: 4000, actions: { action: "SET_SCENE", name: "white", value: 0.05, time: 4000 } }
                        ]
                    }
                ]
                ...
                // See below for more Configuration Options
            }
        },
        ...
    ]
}
```

### General Configuration Options

| Option                  | Details
|------------------------ |--------------
| `outputs`               | *Optional* - A list of output configurations. These outputs can only be set to on or off, there are no in-between values. See the [Output Configuration](#output-configuration-options) section for more details on Output specific configuration options. <br />**Type:** `array`<br />**Default:** `[]`
| `leds`                  | *Optional* - A list of LED output configurations. The LED outputs should be used when PWM dimming is required. See the [LED Configuration](#led-configuration-options) section for more details on LED specific configuration options. <br />**Type:** `array`<br />**Default:** `[]`
| `buttons`               | *Optional* - A list of Button input configurations. See the [Button Configuration](#button-configuration-options) section for more details on Button specific configuration options. <br />**Type:** `array`<br />**Default:** `[]`
| `scenes`                | *Optional* - A list of Scene configurations. See the [Scene Configuration](#scene-configuration-options) section for more details on Scene specific configuration options. <br />**Type:** `array`<br />**Default:** `[]`
| `animations`            | *Optional* - A list of Animation configurations. See the [Animation Configuration](#animation-configuration-options) section for more details on Animation specific configuration options. <br />**Type:** `array`<br />**Default:** `[]`
| `triggers`              | *Optional* - A list of Trigger configurations. See the [Trigger Configuration](#trigger-configuration-options) section for more details on Trigger specific configuration options. <br />**Type:** `array`<br />**Default:** `[]`
| `pinScheme`             | *Optional* - The pin numbering system to use for the input/output `pin` options. See this [interactive pinout diagram](https://pinout.xyz) for more details on pin usage for the Raspberry Pi. <br />**Type:** `string`<br />**Default:** `"BCMv2"`<br />**Options:**<br />- `"BCMv2"` The standard Raspberry Pi GPIO numbering system on current (Rev 2) boards<br />- `"BCMv1"` The standard Raspberry Pi GPIO numbering system on older (Rev 1) boards
| `activeLow`             | *Optional* - A 'global' default setting to use active low mode for the inputs and outputs.  When true, the button actions will be triggered when the GPIO pin is pulled low instead of high, and the output values will be inverted. Note: This option can also be configured for each individual input/output. <br />**Type:** `boolean`<br />**Default:** `false`
| `debounceTimeout`       | *Optional* - A 'global' default setting for the button debounce time, which is the number of milliseconds that the input needs to be stable for the button actions to be triggered. Set to `0` to disable the debounce feature. Note: This option can also be configured for each individual button. <br />**Type:** `number`<br />**Default:** `8`
| `multiPressTimeout`     | *Optional* - A 'global' default setting for the number of milliseconds to wait for another press before triggering a press/release action. Note: This option can also be configured for each individual button. <br />**Type:** `number`<br />**Default:** `325`
| `longPressTime`         | *Optional* - A 'global' default setting for the number of milliseconds to wait before triggering a long press action. Note: This option can also be configured for each individual button. <br />**Type:** `number`<br />**Default:** `4000`
| `clearAlertOnRelease`   | *Optional* - A 'global' default setting to control when a button's long press alert is cleared.  Set to `false` to clear the alert on the long press action, set to `true` to clear the alert on the long release action. Note: This option can also be configured for each individual button. <br />**Type:** `boolean`<br />**Default:** `false`
| `usingPiBlasterService` | *Optional* - If you have setup Pi-Blaster to run as a service on start-up, set this option to `true` to prevent this module from starting its own Pi-Blaster instance. Set to `false` to start Pi-Blaster when this module loads. <br />**Type:** `boolean`<br />**Default:** `false`
| `scriptPath`            | *Optional* - Override the location of the pi-blaster program.  If you already have a pi-blaster installation or want to use a different pi-blaster executable, use this option to set the full path to the file. <br />**Type:** `string`<br />**Default:** `<module_folder>/pi-blaster-pi4-deb10`


### Output Configuration Options
The below options can be used for each Output configuration object in the `config.outputs` array.

| Option                  | Details
|:----------------------- |:-------------
| `name`                  | **REQUIRED** - A name to assign to the output. This name is used as a unique identifier for this output. The name is required to trigger actions for this output. Note: The namespace for Outputs, LED's and Buttons is shared. <br />**Type:** `string`
| `pin`                   | **REQUIRED** - The GPIO Pin number to use for this output. The default pin scheme is the standard Raspberry Pi (BCM) GPIO numbering system for Rev 2 Pi's. See the `pinScheme` option in the [General Configuration](#general-configuration-options) section for more details.<br />**Type:** `number`
| `activeLow`             | *Optional* - Use this option to enable active low mode for the output.  When true, the output values will be inverted. <br />**Type:** `boolean`<br />**Default:** `config.activeLow` (`false`)
| `value`                 | *Optional* - The initial value to assign to the output. The possible values are `0` and `1`, where `0` is 'low' and `1` is 'high'. Note: It is recommended to use pull-up or pull-down resistors in your circuit to guarantee initial state before the module loads. <br />**Type:** `number`<br />**Default:** `0`

### LED Configuration Options
The below options can be used for each LED configuration object in the `config.leds` array.

| Option                  | Details
|:----------------------- |:-------------
| `name`                  | **REQUIRED** - A name to assign to the LED. This name is used as a unique identifier for this LED. The name is required to trigger actions for this LED. Note: The namespace for Outputs, LED's and Buttons is shared. <br />**Type:** `string`
| `pin`                   | **REQUIRED** - The GPIO Pin number to use for this LED. The default pin scheme is the standard Raspberry Pi (BCM) GPIO numbering system for Rev 2 Pi's. See the `pinScheme` option in the [General Configuration](#general-configuration-options) section for more details.<br />**Type:** `number`
| `activeLow`             | *Optional* - Use this option to enable active low mode for the LED.  When true, the LED output values will be inverted. <br />**Type:** `boolean`<br />**Default:** `config.activeLow` (`false`)
| `value`                 | *Optional* - The initial value to assign to the LED output. The possible values are any number between `0` and `1`, where `0` is 'low' and `1` is 'high'. ie. A value of `0.25` would set the LED to 25% brightness. Note: It is recommended to use pull-up or pull-down resistors in your circuit to guarantee initial state before the module loads. <br />**Type:** `number`<br />**Default:** `0`

### Button Configuration Options
The below options can be used for each Button configuration object in the `config.buttons` array.

| Option                  | Details
|:----------------------- |:-------------
| `name`                  | **REQUIRED** - A name to assign to the button. This name is used as a unique identifier for this button. The name is required to trigger actions for this button. Note: The namespace for Outputs, LED's and Buttons is shared. <br />**Type:** `string`
| `pin`                   | **REQUIRED** - The GPIO Pin number to use for this button. The default pin scheme is the standard Raspberry Pi (BCM) GPIO numbering system for Rev 2 Pi's. See the `pinScheme` option in the [General Configuration](#general-configuration-options) section for more details.<br />**Type:** `number`
| `activeLow`             | *Optional* - Use this option to enable active low mode for the button.  When true, the button actions will be triggered when the GPIO pin is pulled low instead of high. <br />**Type:** `boolean`<br />**Default:** `config.activeLow` (`false`)
| `debounceTimeout`       | *Optional* - The number of milliseconds that the input needs to be stable for the button actions to be triggered. Set to `0` to disable the debounce feature. <br />**Type:** `number`<br />**Default:** `config.debounceTimeout` (`8`)
| `multiPressTimeout`     | *Optional* - The number of milliseconds to wait for another press before triggering a press/release action. <br />**Type:** `number`<br />**Default:** `config.multiPressTimeout` (`325`)
| `longPressTime`         | *Optional* - The number of milliseconds to wait before triggering a long press action. <br />**Type:** `number`<br />**Default:** `config.longPressTime` (`4000`)
| `clearAlertOnRelease`   | *Optional* - Control when a button's long press alert is cleared.  Set to `false` to clear the alert on the long press action, set to `true` to clear the alert on the long release action. <br />**Type:** `boolean`<br />**Default:** `config.clearAlertOnRelease` (`false`)
| `longPressAlert`        | *Optional* - Show an alert when waiting for a long press action to be triggered. This alert will be triggered if the button is held for longer than the `multiPressTimeout` time. The alert will be cleared after the `longPressTime` time has passed, or, if `clearAlertOnRelease` is set to `true`, when the button is released. <br />**Type:** `object`<br />**Default:** `undefined`<br />**Options:** The object can have the following `string` items...<br />- `title`: The alert title<br />- `message`: *REQUIRED* - The alert message<br />- `imageFA`: The name of a [font-awesome](https://fontawesome.com/cheatsheet) icon to use as the alert image. i.e. `"info-circle"`
| `onPress`               | *Optional* - An action, or list of actions to run when the PRESS action is triggered. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`
| `onRelease`             | *Optional* - An action, or list of actions to run when the RELEASE action is triggered. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`
| `onDoublePress`         | *Optional* - An action, or list of actions to run when the DOUBLE_PRESS action is triggered. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`
| `onDoubleRelease`       | *Optional* - An action, or list of actions to run when the DOUBLE_RELEASE action is triggered. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`
| `onTripplePress`        | *Optional* - An action, or list of actions to run when the TRIPPLE_PRESS action is triggered. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`
| `onTrippleRelease`      | *Optional* - An action, or list of actions to run when the TRIPPLE_RELEASE action is triggered. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`
| `onLongPress`           | *Optional* - An action, or list of actions to run when the LONG_PRESS action is triggered. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`
| `onLongRelease`         | *Optional* - An action, or list of actions to run when the LONG_RELEASE action is triggered. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`

### Scene Configuration Options
A scene is a set of actions that are executed together. A scene is particularly useful for an RGB LED. The scene can be used to save the specific values of the red, green, and blue internal LED's to achieve a specific color mix. A scene can also be used to set some sort of design with multiple separate LED's. The below options can be used for each Scene configuration object in the `config.scenes` array.

| Option                  | Details
|:----------------------- |:-------------
| `name`                  | **REQUIRED** - A name to assign to the scene. This name is used as a unique identifier for this scene. The name is required to trigger actions for this scene. <br />**Type:** `string`
| `actions`               | **REQUIRED** - An action, or list of actions to run when a scene action is triggered for this scene. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`
| `value`                 | *Optional* - The default value to use when triggering a scene. The value only applies to the LED output components in the scene.  The possible values are any number between `0` and `1`, where `0` is 'low' and `1` is 'high'. i.e. A value of `0.25` would set the scene to 25% brightness. Note: The scene value is not applied directly to the LED outputs, instead the value of each LED output in the scene is calculated using this value as a percentage of the LED value. i.e. If a scene sets an LED output to `0.6`, and the scene value is `0.5` (50%), then the LED value will be set to `0.3` (0.6 x 0.5 = 0.3). <br />**Type:** `number`<br />**Default:** `1`

### Animation Configuration Options
An animation is a set of frames, which contain actions, that are triggered in order with the specified timing. The below options can be used for each Animation configuration object in the `config.animations` array.

| Option                  | Details
|:----------------------- |:-------------
| `name`                  | **REQUIRED** - A name to assign to the animation. This name is used as a unique identifier for this animation. The name is required to trigger actions for this animation. <br />**Type:** `string`
| `frames`                | **REQUIRED** - A step, or list of steps which make up the animation. The frames are triggered in the order they are provided. Each frame waits the specified amount of time before triggering the next frame. <br />**Type:** `object\|array`<br />**Options:** The object can have the following items...<br />- `time`: (`number`) The number of milliseconds to wait before triggering the next frame. *Default:* `1000`<br />- `actions`: (`object\|array`) *REQUIRED* - The actions to trigger for this frame. See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.
| `repeat`                | *Optional* - Whether or not to run the animation in a loop. When `true`, the last frame will trigger the first frame, when `false` the animation will end at the last frame. <br />**Type:** `boolean`<br />**Default:** `true`
| `preStartActions`       | *Optional* - An action, or list of actions to run when an animation is started.  The actions are executed before the first frame is executed. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`
| `onStopActions`         | *Optional* - An action, or list of actions to run when an animation is stopped.  These actions are executed when the STOP action is triggered, not when the animation ends normally. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`<br />**Default:** `[]`

### Trigger Configuration Options
A trigger is a list of actions that are executed when a specific module notification is received. The notifications are filtered against the trigger's filter settings; they can be filtered against the notification, payload and/or sender. The below options can be used for each Trigger configuration object in the `config.triggers` array.

| Option                  | Details
|:----------------------- |:-------------
| `actions`               | **REQUIRED** - An action, or list of actions to run when the notification, payload, and sender filters are all matched. <br />See the [Action Configuration](#action-configuration-options) section for more details on the Action object options.<br />**Type:** `object\|array`
| `notification`          | *Optional* - The notification to use for filtering. When a module notification is received, it must match this notification for the actions to be executed. If this option is left `undefined`, then all notifications will be considered a match.<br />**Type:** `any`<br />**Default:** `undefined`
| `payload`               | *Optional* - The payload to use for filtering. When a module notification is received, it's payload must match this payload for the actions to be executed. If this option is left `undefined`, then all payloads will be considered a match.<br />**Type:** `any`<br />**Default:** `undefined`
| `sender`                | *Optional* - The sender name to use for filtering. When a module notification is received, it's sender's name must match this sender name for the actions to be executed. If this option is left `undefined`, then all sender names will be considered a match.<br />**Type:** `string`<br />**Default:** `undefined`


### Action Configuration Options
An action is a command to execute against a specified Output, LED, Button, Scene or Animation. The below options can be used for each Action configuration object.

| Option                  | Details
|:----------------------- |:-------------
|`action`                 |**REQUIRED** - The name of the action to perform. <br />See the [Action List](#action-list) for more details about each type of action. <br />**Type:** `string`
|`name`                   |**REQUIRED** (*Optional*) - The name of output, LED, button, scene, or animation for the action to be applied. Note: There are some actions which do not require a name to be specified. <br />**Type:** `string`<br />**Default:** `undefined`<br />**Applies To:** Outputs, LEDs, Buttons, Scenes, and Animations
|`value`                  |*Optional* - The value to apply to the item specified by the name.  For LEDs (and scenes with LEDs) possible values are any number between `0` and `1`, where `0` is 'low' and `1` is 'high'. For Outputs, the possible values are `0` and `1`, where `0` is 'low' and `1` is 'high'. <br />**Type:** `number`<br />**Default:** `undefined`<br />**Applies To:** Outputs, LEDs, and Scenes
|`time`                   |*Optional* - For LEDs and Scenes with the `"SET"` action, this is the duration of the fade effect between the current value and the given value. For the Outputs and LEDs with the `"BLINK"` action, this is the duration that the Output or LED stays on for. <br />**Type:** `number`<br />**Default:** `undefined`<br />**Applies To:** Outputs, LEDs, and Scenes
|`offTime`                |*Optional* - For the Outputs and LEDs with the `"BLINK"` action, this is the duration that the Output or LED stays off for. <br />**Type:** `number`<br />**Default:** `undefined`<br />**Applies To:** Outputs and LEDs
|`delay`                  |*Optional* - The number of milliseconds to wait before executing the action. <br />**Type:** `number`<br />**Default:** `0`<br />**Applies To:** Outputs, LEDs, Buttons, Scenes, and Animations
|`notification`           |*Optional* - The module notification to send when using the `"NOTIFY"` action. <br />**Type:** `any`<br />**Default:** `undefined`<br />**Applies To:** N/A
|`payload`                |*Optional* - The payload to send when using the `"NOTIFY"` action. <br />**Type:** `any`<br />**Default:** `undefined`<br />**Applies To:** N/A

### Action List
| Action                  | Details
|:----------------------- |:-------------
|`"SET"`                  |Set the value of an Output or LED. For LEDs, possible values are any number between `0` and `1`. For Outputs, the possible values are `0` and `1`.<br />**Properties:** `name`, `value`, `time`, `delay`<br />**Applies To:** Outputs and LEDs<br />**Example:** `{ action: "SET", name: "item_name", value: 0.75, time: 2500 }`
|`"INCREASE"`             |Increase the value of an LED by the specified `value` amount. If no `value` is specified, `0.1` is used. <br />**Properties:** `name`, `value`, `time`, `delay`<br />**Applies To:** LEDs<br />**Example:** `{ action: "INCREASE", name: "led_name", value: 0.2, time: 500 }`
|`"DECREASE"`             |Decrease the value of an LED by the specified `value` amount. If no `value` is specified, `0.1` is used. <br />**Properties:** `name`, `value`, `time`, `delay`<br />**Applies To:** LEDs<br />**Example:** `{ action: "DECREASE", name: "led_name", value: 0.2, time: 500 }`
|`"TOGGLE"`               |Toggle the value of an Output or LED. If `value` is specified, it will be used as the 'on' value. If no `value` is specified, the current LED value will be used, or, if the LED is off, `1` will be used. <br />**Properties:** `name`, `value`, `time`, `delay`<br />**Applies To:** Outputs and LEDs<br />**Example:** `{ action: "TOGGLE", name: "item_name", value: 0.8, time: 3000 }`
|`"BLINK"`                |Blink an Output or LED on and off. The `time` parameter can be used to specify the on time in milliseconds. If `time` is not specified, a default value of `750` will be used. The `offTime` parameter can be used to specify the off time in milliseconds. If `offTime` is not specified, the `time` value will be used. For LEDs, use the `value` parameter to specify the on brightness. If no `value` is specified, the current LED value will be used, or, if the LED is off, `1` will be used. <br />**Properties:** `name`, `value`, `time`, `offTime`, `delay`<br />**Applies To:** Outputs and LEDs<br />**Example:** `{ action: "BLINK", name: "item_name", value: 1, time: 800, offTime: 1200 }`
|`"SET_SCENE"`            |Set the value of a Scene. <br />**Properties:** `name`, `value`, `time`, `delay`<br />**Applies To:** Scenes<br />**Example:** `{ action: "SET_SCENE", name: "scene_name", value: 0.75, time: 2500 }`
|`"INCREASE_SCENE"`       |Increase the value of a scene by the specified `value` amount. If no `value` is specified, `0.1` is used. <br />**Properties:** `name`, `value`, `time`, `delay`<br />**Applies To:** Scenes<br />**Example:** `{ action: "INCREASE_SCENE", name: "scene_name", value: 0.2, time: 500 }`
|`"DECREASE_SCENE"`       |Decrease the value of a scene by the specified `value` amount. If no `value` is specified, `0.1` is used. <br />**Properties:** `name`, `value`, `time`, `delay`<br />**Applies To:** Scenes<br />**Example:** `{ action: "DECREASE_SCENE", name: "scene_name", value: 0.2, time: 500 }`
|`"TOGGLE_SCENE"`         |Toggle the value of a Scene. If `value` is specified it will be used as the 'on' value. <br />**Properties:** `name`, `value`, `time`, `delay`<br />**Applies To:** Scenes<br />**Example:** `{ action: "TOGGLE_SCENE", name: "scene_name", value: 0.65, time: 1500 }`
|`"START"`                |Start running an Animation. <br />**Properties:** `name`<br />**Applies To:** Animations<br />**Example:** `{ action: "START", name: "animation_name" }`
|`"STOP"`                 |Stop a running Animation and execute the stop actions. <br />**Properties:** `name`<br />**Applies To:** Animations<br />**Example:** `{ action: "STOP", name: "animation_name" }`
|`"STOP_ALL"`             |Stop all running Animations. <br />**Properties:** N/A<br />**Applies To:** Animations<br />**Example:** `{ action: "STOP_ALL" }`
|`"NOTIFY"`               |Send a module notification to all other modules. <br />**Properties:** `notification`, `payload`<br />**Applies To:** N/A<br />**Example:**<br />`{ action: "NOTIFY", notification: "NOTIFICATION_NAME", payload: { property: "value" } }`
|`"PRESS"`               |Execute the actions assigned to the onPress trigger for the specified button. <br />**Properties:** `name`, `delay`<br />**Applies To:** Buttons<br />**Example:**`{ action: "PRESS", name: "button_name" }`
|`"RELEASE"`               |Execute the actions assigned to the onRelease trigger for the specified button. <br />**Properties:** `name`, `delay`<br />**Applies To:** Buttons<br />**Example:**`{ action: "RELEASE", name: "button_name" }`
|`"DOUBLE_PRESS"`               |Execute the actions assigned to the onDoublePress trigger for the specified button. <br />**Properties:** `name`, `delay`<br />**Applies To:** Buttons<br />**Example:**`{ action: "DOUBLE_PRESS", name: "button_name" }`
|`"DOUBLE_RELEASE"`               |Execute the actions assigned to the onDoubleRelease trigger for the specified button. <br />**Properties:** `name`, `delay`<br />**Applies To:** Buttons<br />**Example:**`{ action: "DOUBLE_RELEASE", name: "button_name" }`
|`"TRIPLE_PRESS"`               |Execute the actions assigned to the onTriplePress trigger for the specified button. <br />**Properties:** `name`, `delay`<br />**Applies To:** Buttons<br />**Example:**`{ action: "TRIPLE_PRESS", name: "button_name" }`
|`"TRIPLE_RELEASE"`               |Execute the actions assigned to the onTripleRelease trigger for the specified button. <br />**Properties:** `name`, `delay`<br />**Applies To:** Buttons<br />**Example:**`{ action: "TRIPLE_RELEASE", name: "button_name" }`
|`"LONG_PRESS"`               |Execute the actions assigned to the onLongPress trigger for the specified button. <br />**Properties:** `name`, `delay`<br />**Applies To:** Buttons<br />**Example:**`{ action: "LONG_PRESS", name: "button_name" }`
|`"LONG_RELEASE"`               |Execute the actions assigned to the onLongRelease trigger for the specified button. <br />**Properties:** `name`, `delay`<br />**Applies To:** Buttons<br />**Example:**`{ action: "LONG_RELEASE", name: "button_name" }`

## Wiring Buttons and LED's
Here are some wiring examples. The BLUE wires are for Active-Low circuits and PURPLE wires are for Active-High circuits.
![Example of MMM-GPIO Breadboard Breadboard](images/mmm-gpio-wiring-breadboard.png?raw=true "Example of a wiring breadboard")

![Example of MMM-GPIO Wiring Schematic](images/mmm-gpio-wiring-schematic.png?raw=true "Example of a wiring schematic")

## Updating the Module
To update the module to the latest version, use your terminal to:
1. Navigate to your MMM-GPIO folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules/MMM-GPIO`
2. Update the module by executing the following command:<br />`git pull`

If you have changed the module on your own, the update will fail. <br />To force an update (WARNING! your changes will be lost), reset the module and then update with the following commands:
```
git reset --hard
git pull
```

## License

### The MIT License (MIT)

Copyright © 2018 David Dearden

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

**The software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.**
