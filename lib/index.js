/**
 * @file index.js
 * @author Pallob K. Gain (pallobkgain@gmail.com)
 * @M10Xcore V2.0 board libgpiod in nodejs
 * @version 0.1
 * @date 2023-06-2
 * 
 * @copyright Copyright (c) 2023
 * 
 * REF: 
 *  https://elixir.bootlin.com/linux/v4.7/source/include/uapi/linux/gpio.h
 *  ioctl: https://www.circlemud.org/jelson/software/fusd/docs/node31.html
 *  https://elixir.bootlin.com/linux/v4.7/source/arch/alpha/include/uapi/asm/ioctl.h#L48
 *  https://github.com/torvalds/linux/blob/master/include/uapi/linux/gpio.h
 */

const fs = require('fs');
const ioctl = require('ioctl');
const Struct = require('./struct.js');

/*
[19162.283721] GPIO_GET_CHIPINFO_IOCTL=2151986177
[19162.290313] GPIO_GET_LINEINFO_IOCTL=3225990146
[19162.295684] GPIO_GET_LINEHANDLE_IOCTL=3245126659
[19162.301116] GPIO_GET_LINEEVENT_IOCTL=3224417284
[19162.306152] GPIOHANDLE_GET_LINE_VALUES_IOCTL=3225465864
[19162.311798] GPIOHANDLE_SET_LINE_VALUES_IOCTL=3225465865

[  607.323425] GPIOHANDLE_SET_CONFIG_IOCTL=3226776586
[  607.328704] GPIO_GET_LINEINFO_UNWATCH_IOCTL  =3221533708
[  607.334472] GPIO_GET_LINEINFO_WATCH_IOCTL       =3225990155
*/

/*IOCTL FLAGS */
const GPIO_GET_CHIPINFO_IOCTL = 0x8044B401;
const GPIO_GET_LINEINFO_IOCTL = 0xC048B402;
const GPIO_GET_LINEHANDLE_IOCTL = 0xC16CB403;
const GPIO_GET_LINEEVENT_IOCTL = 0xC030B404;
const GPIOHANDLE_GET_LINE_VALUES_IOCTL = 0xC040B408;
const GPIOHANDLE_SET_LINE_VALUES_IOCTL = 0xC040B409;
const GPIOHANDLE_SET_CONFIG_IOCTL = 0xC054B40A;
const GPIO_GET_LINEINFO_UNWATCH_IOCTL = 0xC004B40C;
const GPIO_GET_LINEINFO_WATCH_IOCTL = 0xC048B40B;


const GPIO_MAX_NAME_SIZE = 32;
const GPIOHANDLES_MAX = 64;
/* Linerequest flags */
const GPIOHANDLE_REQUEST_INPUT = (1 << 0);
const GPIOHANDLE_REQUEST_OUTPUT = (1 << 1);
const GPIOHANDLE_REQUEST_ACTIVE_LOW = (1 << 2);
const GPIOHANDLE_REQUEST_OPEN_DRAIN = (1 << 3);
const GPIOHANDLE_REQUEST_OPEN_SOURCE = (1 << 4);
const GPIOHANDLE_REQUEST_BIAS_PULL_UP = (1 << 5);
const GPIOHANDLE_REQUEST_BIAS_PULL_DOWN = (1 << 6);
const GPIOHANDLE_REQUEST_BIAS_DISABLE = (1 << 7);

/* Line is in use by the kernel */
const GPIOLINE_FLAG_KERNEL = (1 << 0);
const GPIOLINE_FLAG_IS_OUT = (1 << 1);
const GPIOLINE_FLAG_ACTIVE_LOW = (1 << 2);
const GPIOLINE_FLAG_OPEN_DRAIN = (1 << 3);
const GPIOLINE_FLAG_OPEN_SOURCE = (1 << 4);

/**
 * GPIO event types
 */
const GPIOEVENT_EVENT_RISING_EDGE = 0x01;
const GPIOEVENT_EVENT_FALLING_EDGE = 0x02;

/* Eventrequest flags */
const GPIOEVENT_REQUEST_RISING_EDGE = (1 << 0);
const GPIOEVENT_REQUEST_FALLING_EDGE = (1 << 1);
const GPIOEVENT_REQUEST_BOTH_EDGES = ((1 << 0) | (1 << 1));

/**
 * struct gpiochip_info - Information about a certain GPIO chip
 * @name: the Linux kernel name of this GPIO chip
 * @label: a functional name for this GPIO chip, such as a product
 * number, may be NULL
 * @lines: number of GPIO lines on this chip
 */

const gpiochip_info = Struct.makeType({
    name: Struct.stringType(GPIO_MAX_NAME_SIZE),
    label: Struct.stringType(GPIO_MAX_NAME_SIZE),
    lines: Struct.type.uint32_t,
});

/**
 * struct gpioline_info - Information about a certain GPIO line
 * @line_offset: the local offset on this GPIO device, fill this in when
 * requesting the line information from the kernel
 * @flags: various flags for this line
 * @name: the name of this GPIO line, such as the output pin of the line on the
 * chip, a rail or a pin header name on a board, as specified by the gpio
 * chip, may be NULL
 * @consumer: a functional name for the consumer of this GPIO line as set by
 * whatever is using it, will be NULL if there is no current user but may
 * also be NULL if the consumer doesn't set this up
 */

const gpioline_info = Struct.makeType({
    line_offset: Struct.type.uint32_t,
    flags: Struct.type.uint32_t,
    name: Struct.stringType(GPIO_MAX_NAME_SIZE),
    consumer: Struct.stringType(GPIO_MAX_NAME_SIZE)
});


/**
 * struct gpiohandle_request - Information about a GPIO handle request
 * @lineoffsets: an array desired lines, specified by offset index for the
 * associated GPIO device
 * @flags: desired flags for the desired GPIO lines, such as
 * GPIOHANDLE_REQUEST_OUTPUT, GPIOHANDLE_REQUEST_ACTIVE_LOW etc, OR:ed
 * together. Note that even if multiple lines are requested, the same flags
 * must be applicable to all of them, if you want lines with individual
 * flags set, request them one by one. It is possible to select
 * a batch of input or output lines, but they must all have the same
 * characteristics, i.e. all inputs or all outputs, all active low etc
 * @default_values: if the GPIOHANDLE_REQUEST_OUTPUT is set for a requested
 * line, this specifies the default output value, should be 0 (low) or
 * 1 (high), anything else than 0 or 1 will be interpreted as 1 (high)
 * @consumer_label: a desired consumer label for the selected GPIO line(s)
 * such as "my-bitbanged-relay"
 * @lines: number of lines requested in this request, i.e. the number of
 * valid fields in the above arrays, set to 1 to request a single line
 * @fd: if successful this field will contain a valid anonymous file handle
 * after a GPIO_GET_LINEHANDLE_IOCTL operation, zero or negative value
 * means error
 */

const gpiohandle_request = Struct.makeType({
    lineoffsets: Struct.arrayType(Struct.type.uint32_t, GPIOHANDLES_MAX),
    flags: Struct.type.uint32_t,
    default_values: Struct.arrayType(Struct.type.uint8_t, GPIOHANDLES_MAX),
    consumer_label: Struct.stringType(GPIO_MAX_NAME_SIZE),
    lines: Struct.type.uint32_t,
    fd: Struct.type.int,
});



/**
 * struct gpiohandle_data - Information of values on a GPIO handle
 * @values: when getting the state of lines this contains the current
 * state of a line, when setting the state of lines these should contain
 * the desired target state
 */

const gpiohandle_data = Struct.makeType({
    values: Struct.arrayType(Struct.type.uint8_t, GPIOHANDLES_MAX)
});

/**
 * struct gpiohandle_config - Configuration for a GPIO handle request
 * @flags: updated flags for the requested GPIO lines, such as
 * %GPIOHANDLE_REQUEST_OUTPUT, %GPIOHANDLE_REQUEST_ACTIVE_LOW etc, added
 * together
 * @default_values: if the %GPIOHANDLE_REQUEST_OUTPUT is set in flags,
 * this specifies the default output value, should be 0 (low) or
 * 1 (high), anything else than 0 or 1 will be interpreted as 1 (high)
 * @padding: reserved for future use and should be zero filled
 *
 * Note: This struct is part of ABI v1 and is deprecated.
 * Use &struct gpio_v2_line_config instead.
 */
const gpiohandle_config = Struct.makeType({
    flags: Struct.type.uint32_t,
    default_values: Struct.arrayType(Struct.type.uint8_t, GPIOHANDLES_MAX),
    padding: Struct.arrayType(Struct.type.uint32_t, 4)/* padding for future use */
});


/**
 * struct gpioevent_request - Information about a GPIO event request
 * @lineoffset: the desired line to subscribe to events from, specified by
 * offset index for the associated GPIO device
 * @handleflags: desired handle flags for the desired GPIO line, such as
 * %GPIOHANDLE_REQUEST_ACTIVE_LOW or %GPIOHANDLE_REQUEST_OPEN_DRAIN
 * @eventflags: desired flags for the desired GPIO event line, such as
 * %GPIOEVENT_REQUEST_RISING_EDGE or %GPIOEVENT_REQUEST_FALLING_EDGE
 * @consumer_label: a desired consumer label for the selected GPIO line(s)
 * such as "my-listener"
 * @fd: if successful this field will contain a valid anonymous file handle
 * after a %GPIO_GET_LINEEVENT_IOCTL operation, zero or negative value
 * means error
 *
 * Note: This struct is part of ABI v1 and is deprecated.
 * Use &struct gpio_v2_line_request instead.
 */

const gpioevent_request = Struct.makeType({
    lineoffset: Struct.type.uint32_t,
    handleflags: Struct.type.uint32_t,
    eventflags: Struct.type.uint32_t,
    consumer_label: Struct.stringType(GPIO_MAX_NAME_SIZE),
    fd: Struct.type.int
});

/**
 * struct gpioevent_data - The actual event being pushed to userspace
 * @timestamp: best estimate of time of event occurrence, in nanoseconds
 * @id: event identifier
 *
 * Note: This struct is part of ABI v1 and is deprecated.
 * Use &struct gpio_v2_line_event instead.
 */

const gpioevent_data = Struct.makeType({
    timestamp: Struct.type.uint64_t,
    id: Struct.type.uint32_t
});


class gpiod {

    static INPUT_MODE = GPIOHANDLE_REQUEST_INPUT;
    static OUTPUT_MODE = GPIOHANDLE_REQUEST_OUTPUT;
    static ACTIVE_LOW = GPIOHANDLE_REQUEST_ACTIVE_LOW;
    static OPEN_DRAIN = GPIOHANDLE_REQUEST_OPEN_DRAIN;
    static OPEN_SOURCE = GPIOHANDLE_REQUEST_OPEN_SOURCE;
    static PULL_UP = GPIOHANDLE_REQUEST_BIAS_PULL_UP;
    static PULL_DOWN = GPIOHANDLE_REQUEST_BIAS_PULL_DOWN;
    static PULL_NONE = GPIOHANDLE_REQUEST_BIAS_DISABLE;
    static INPUT = GPIOHANDLE_REQUEST_INPUT | GPIOHANDLE_REQUEST_BIAS_DISABLE;
    static INPUT_PULLUP = GPIOHANDLE_REQUEST_INPUT | GPIOHANDLE_REQUEST_BIAS_PULL_UP;
    static INPUT_PULLDOWN = GPIOHANDLE_REQUEST_INPUT | GPIOHANDLE_REQUEST_BIAS_PULL_DOWN;
    static OUTPUT = GPIOHANDLE_REQUEST_OUTPUT;
    static RISING_EDGE = GPIOEVENT_REQUEST_RISING_EDGE;
    static FALLING_EDGE = GPIOEVENT_REQUEST_FALLING_EDGE;
    static BOTH_EDGE = GPIOEVENT_REQUEST_BOTH_EDGES;
    static EVENT_FALLING = GPIOEVENT_EVENT_FALLING_EDGE;
    static EVENT_RISING = GPIOEVENT_EVENT_RISING_EDGE;

    file_device_link;
    file_device;

    constructor(file_device_link) {
        this.file_device_link = file_device_link;
    }

    open() {
        return new Promise((accept, reject) => {
            fs.open(this.file_device_link, 'r+', (err, fd) => {
                if (err) {
                    return reject(err);
                }
                this.file_device = fd;
                accept(this);
            });
        });
    }

    close() {
        fs.close(this.file_device);
    }

    getFlagNames(flags) {
        let names = [];
        if ((flags & GPIOLINE_FLAG_KERNEL) > 0) names.push('kernel');
        if ((flags & GPIOLINE_FLAG_IS_OUT) > 0) names.push('output');
        if ((flags & GPIOLINE_FLAG_ACTIVE_LOW) > 0) names.push('active_low');
        if ((flags & GPIOLINE_FLAG_OPEN_DRAIN) > 0) names.push('open_drain');
        if ((flags & GPIOLINE_FLAG_OPEN_SOURCE) > 0) names.push('open_source');
        return names;
    }

    get_chip_info() {
        return new Promise((accept, reject) => {

            var info = new Struct(gpiochip_info);

            try {
                var ret = ioctl(this.file_device, GPIO_GET_CHIPINFO_IOCTL, info.ref());

                if (ret < 0) return reject('Info reading error.');

                accept(info.data());

            }
            catch (err) {
                reject(err);
            }
        });
    }

    get_line_info(line_offset) {
        return new Promise((accept, reject) => {

            var info = new Struct(gpioline_info);
            if (!info.set('line_offset', line_offset)) return reject('Line offset setting error.');


            try {
                var ret = ioctl(this.file_device, GPIO_GET_LINEINFO_IOCTL, info.ref());

                if (ret < 0) return reject('Info line reading error.');

                let line_info = info.data();
                line_info.flag_names = this.getFlagNames(line_info.flags);

                accept(line_info);
            }
            catch (err) {
                reject(err);
            }
        });
    }



    request_mode(pins, flags, initial_states, name) {
        return new Promise((accept, reject) => {

            pins = Array.isArray(pins) ? pins : [pins];

            if (initial_states) {
                if (!Array.isArray(initial_states)) {
                    let state = initial_states;
                    initial_states = new Uint8Array(pins.length);
                    initial_states.fill(state);
                }
            }
            else {
                initial_states = new Uint8Array(pins.length);
                initial_states.fill(0);
            }

            var req = new Struct(gpiohandle_request);

            //console.log({flags});

            if (!req.set('flags', flags)) return reject('Flags setting error.');
            if (!req.set('lines', pins.length)) return reject('Lines setting error.');
            if (!req.set('lineoffsets', pins)) return reject('lineoffsets setting error.');
            if (!req.set('default_values', initial_states)) return reject('default_values setting error.');

            if (name) {
                if (!req.set('consumer_label', name)) return reject('consumer_label setting error.');
            }

            try {
                var ret = ioctl(this.file_device, GPIO_GET_LINEHANDLE_IOCTL, req.ref());

                if (ret < 0) return reject('Mode Request error.');

                accept(req.data());
            }
            catch (err) {
                reject(err);
            }
        });
    }

    config(req, flags, initial_states) {
        return new Promise((accept, reject) => {
            if (!req || !('fd' in req)) return reject("Request device not passed.");

            if (initial_states) {
                if (!Array.isArray(initial_states)) {
                    let state = initial_states;
                    initial_states = new Uint8Array(req.lines);
                    initial_states.fill(state);
                }
            }
            else {
                initial_states = new Uint8Array(req.lines);
                initial_states.fill(0);
            }

            var hcfg = new Struct(gpiohandle_config);

            if (!hcfg.set('flags', flags)) return reject('Flags setting error.');
            if (!hcfg.set('default_values', initial_states)) return reject('default_values setting error.');

            try {
                var ret = ioctl(req.fd, GPIOHANDLE_SET_CONFIG_IOCTL, hcfg.ref());

                if (ret < 0) return reject('Mode Request error.');

                accept(hcfg.data());
            }
            catch (err) {
                reject(err);
            }

        });
    }

    set_values(req, values) {
        return new Promise((accept, reject) => {
            if (!req || !('fd' in req)) return reject("Request device not passed.");

            values = Array.isArray(values) ? values : [values];

            var data = new Struct(gpiohandle_data);
            if (!data.set('values', values)) return reject('Values setting error.');
            try {

                var ret = ioctl(req.fd, GPIOHANDLE_SET_LINE_VALUES_IOCTL, data.ref());
                if (ret < 0) return reject('Set value error.');

                let result = data.data().values.slice(0, req.lines);
                accept(result.length > 1 ? result : result[0]);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    get_values(req) {
        return new Promise((accept, reject) => {
            if (!req || !('fd' in req)) return reject("Request device not passed.");

            var data = new Struct(gpiohandle_data);
            try {

                var ret = ioctl(req.fd, GPIOHANDLE_GET_LINE_VALUES_IOCTL, data.ref());
                if (ret < 0) return reject('Set value error.');

                let result = data.data().values.slice(0, req.lines);
                accept(result.length > 1 ? result : result[0]);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    request_event(pin, flags, mode, name) {
        return new Promise((accept, reject) => {

            var req = new Struct(gpioevent_request);

            //console.log({flags});

            if (!req.set('lineoffset', pin)) return reject('lineoffset setting error.');
            if (!req.set('handleflags', flags)) return reject('handleflags setting error.');
            if (!req.set('eventflags', mode)) return reject('eventflags setting error.');

            if (name) {
                if (!req.set('consumer_label', name)) return reject('consumer_label setting error.');
            }

            try {
                var ret = ioctl(this.file_device, GPIO_GET_LINEEVENT_IOCTL, req.ref());

                if (ret < 0) return reject('Mode Request error.');

                accept(req.data());
            }
            catch (err) {
                reject(err);
            }
        });
    }

    attach_event(req,callback){
        return new Promise((accept, reject) => {
            if (!req || !('fd' in req)) return reject("Request device not passed.");
            try {
                
                //fs.read(fd, buffer, offset, length, position, callback)

                var event = new Struct(gpioevent_data);
                const event_size=event.ref().length+4; //because during file read there has a file ending command of 4 bytes

                // read its contents into buffer
                // Create a read stream from the file descriptor
                const readStream = fs.createReadStream(null, { fd: req.fd });

                
                let remainBuffer=Buffer.alloc(0);
                let lastEventId=-1;
                // Listen for 'data' event to read data from the stream
                readStream.on('data', (data) => {
                    data=Buffer.concat([remainBuffer,data]);
                    if(data.length<event_size){
                        remainBuffer=data;
                        return;
                    }

                    let offset=0;
                    while(data.length-offset>=event_size){
                        
                        data.copy(event.ref(),0,offset,event_size);
                        offset+=event_size;
                        
                        let eventId=event.get('id');
                        if(lastEventId!=eventId){
                            lastEventId=eventId;
                            callback(null,{id:eventId,timestamp:event.get('timestamp')});
                        }
                    }
                    //remain buffer
                    remainBuffer=Buffer.from(data.buffer, offset,data.length-offset);    
                });

                // Listen for 'error' event in case of any errors
                readStream.on('error', (err) => {
                    callback(err);
                });

                accept(true);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    terminate_request(req) {
        return new Promise((accept, reject) => {
            if (!req || !('fd' in req)) return reject("Request device not passed.");
            try {
                fs.close(req.fd, (err) => {
                    if (err) return reject(err);
                    accept(true);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }


}


module.exports = gpiod;