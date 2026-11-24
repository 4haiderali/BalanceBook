export const KARACHI_TIME_ZONE='Asia/Karachi';

const karachiDate=new Intl.DateTimeFormat('en-CA',{
 timeZone:KARACHI_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
});

export const today=()=>karachiDate.format(new Date());
