import React, { useState } from 'react';
import { Drawer, Radio, Space, Button,DatePicker  } from 'antd';

function Home({show, setShow, setTitleButton, setTitleDate}) {
  const [visibleSubDrawer, setVisibleSubDrawer] = useState(false);

  const onCloseMain = () => {
    setShow(false);
  };

  const showSubDrawer = () => {
    setVisibleSubDrawer(true);
  };

  const onCloseSub = () => {
    setVisibleSubDrawer(false);
  };

// Esta función toma dos fechas y retorna una cadena en el formato 'Mmm dd-dd, yyyy'
const formatDateRange = (startDate, endDate) => {
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()}-${endDate.getDate()}, ${endDate.getFullYear()}`;
  } else {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
};

const handleRadioChange = e => {
  setTitleButton(e.target.value);

  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  switch(e.target.value){
      case "Today":
          setTitleDate(formatDateRange(now, now));
          break;
      case "This week":
          setTitleDate(formatDateRange(weekStart, now));
          break;
      case "This month":
        console.log(formatDateRange(monthStart, now))
          setTitleDate(formatDateRange(monthStart, now));
          break;
      case "Custom":
          showSubDrawer();
          break;
      default:
          setTitleDate("");
          break;
  }
};
const handleRangeChange = dates => {
  if (dates) {
    const [start, end] = dates;
    setTitleDate(formatDateRange(start.toDate(), end.toDate()));
  }
};



  return (
    <>
      <Drawer
        title="Filter"
        placement="right"
        closable={false}
        onClose={onCloseMain}
        visible={show}
        extra={
          <Space>
            <Button onClick={() =>setShow(false)}><i className='fas fa-times'></i></Button>
          </Space>
        }
      >
        <Radio.Group size='large' onChange={handleRadioChange} direction="vertical">
          <Radio value={"Today"}  className='w-100  m-1'>Today</Radio>
          <Radio value={"This week"} className='w-100 m-1'>This week</Radio>
          <Radio value={"This month"} className='w-100 m-1'>This month</Radio>
          <Radio value='Custom' className='w-100 m-1'>Custom</Radio>
        </Radio.Group>

        <Drawer
          title="Calendar"
          placement="right"
          closable={false}
          onClose={onCloseSub}
          visible={visibleSubDrawer}
        >
          <DatePicker.RangePicker onChange={handleRangeChange} />
        </Drawer>
      </Drawer>
    </>
  );
}

export default Home;
