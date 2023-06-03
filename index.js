const gpiod=require('./lib/index.js');

const gpio5=new gpiod('/dev/gpiochip6'); //for gpio5 the chardev is gpiochip6


console.log("Chardev..");

gpio5.open()
.then(async ()=>{
    console.log("File got open");

    try{
        let info=await gpio5.get_chip_info();
        console.log({info});
        
        console.log("----Lines------");

        for(let i=0;i<info.lines;i++){
            let line_info=await gpio5.get_line_info(i); //gpios
            console.log(line_info);
        }

        //console.log("----mode request------");
        //let req=await gpio5.request_mode(7,gpiod.OUTPUT_MODE,0,"GPIO5_7"); //gpio5_7 as output
        //await gpio5.set_values(req,1); //set value to the requested pin

        // let req=await gpio5.request_mode(7,gpiod.INPUT_MODE); //gpio5_7 as input
        // //await gpio5.config(req,gpiod.PULL_UP); //todo--> not working

        // setInterval((async (req)=>{
        //     let state=await gpio5.get_values(req);
        //     console.log({state});
        // }).bind(null,req),500);

        console.log("----Event request------");
        let req=await gpio5.request_event(7,gpiod.INPUT_MODE,gpiod.BOTH_EDGE,"GPIO5_7_EVENT"); //gpio5_7 event request
        
        gpio5.attach_event(req,(err,event)=>{
            if(err)return console.error(err);
            console.log(`Event ${event.id==gpiod.EVENT_FALLING?"FALLING":"RISING"} -->`,event.timestamp);
        });
        //console.log({req});
        /*
        setTimeout(()=>{
            gpio5.terminate_request(req);
            gpio5.close();

            console.log("GPIO closed");
        },20000);
        */

    }
    catch(err){
        console.error(err);
    }

    //gpio5.close(); //closing gpio
})
.catch(err=>{
    console.error(err);
});

//keep active
setInterval(()=>{
},1000);