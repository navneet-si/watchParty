// create room

const side_bar = document.getElementById('side_bar');

side_bar.addEventListener("click", () => {
    chrome.tabs.query({active : true, currentWindow :true}, (tabs)=>{
        const activeTabs = tabs[0];
        const uuid = crypto.randomUUID();
        const url =  new URL(activeTabs.url);
        url.searchParams.set('sync_room', uuid);
        const final = url.toString();
        console.log(final);
        chrome.runtime.sendMessage({ action: "room_created", roomId: uuid , inviteLink: final});
        chrome.tabs.sendMessage(activeTabs.id, { 
            action: "add_sideBar", 
            roomId: uuid, 
            inviteLink: final
        });
    })
    // window.close();
});


//join room

const to_join = document.getElementById('join-btn');
to_join.addEventListener("click",()=>{
    const roomId = document.getElementById('room-input').value;
    if(!roomId){
        return;
    }
    chrome.tabs.query({active : true, currentWindow :true}, (tabs)=>{
        const activeTabs = tabs[0]; 
        chrome.runtime.sendMessage({ action:"join_room" , roomId: roomId});
    })
    // window.close();
})

