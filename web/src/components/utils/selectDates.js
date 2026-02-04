import React, { useState, useEffect } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
} from "date-fns";
import {
  Typography,
  Dropdown,
  Menu,
  Button,
  Drawer,
  DatePicker,
} from "antd";
import { connect, useDispatch } from "react-redux";

const { Text } = Typography;
const { RangePicker } = DatePicker;
const currentDate = new Date();
const CardPoint = ({action}) => {
  const dispatch = useDispatch();
  const [isCustomDrawerOpen, setIsCustomDrawerOpen] = useState(false);
  const [customRange, setCustomRange] = useState([]);
  const [titleDate, setTitleDate] = useState(format(currentDate, 'MMM dd, yyyy'));
  const [selectedRange, setSelectedRange] = useState([]);
  const [selectValue, setSelectValue] = useState("thisMonth");
  
  const options = [
    "thisYear",
    "thisMonth",
    "thisWeek",
    "today",
    "yesterday",
    "lastMonth",
    "lastWeek",
    "lastYear",
    "custom",
  ];

  const handleSelectChange = (value) => {
    setSelectValue(formatKeyToReadableText(value));
    if (value === "custom") {
      
      setIsCustomDrawerOpen(true);

      return;
    }

    let start, end;

    const formatDate = (date) => format(date, "yyyy-MM-dd");

    switch (value) {
      case "thisYear":
        start = startOfYear(new Date());
        end = endOfYear(new Date());
        break;
      case "thisMonth":
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
        break;
      case "thisWeek":
        start = startOfWeek(new Date());
        end = endOfWeek(new Date());
        break;
      case "today":
        start = new Date();
        end = new Date();
        break;
      case "yesterday":
        start = subDays(new Date(), 1);
        end = subDays(new Date(), 1);
        break;
      case "lastMonth":
        start = startOfMonth(subDays(new Date(), 30));
        end = endOfMonth(subDays(new Date(), 30));
        break;
      case "lastWeek":
        start = startOfWeek(subDays(new Date(), 7));
        end = endOfWeek(subDays(new Date(), 7));
        break;
      case "lastYear":
        start = startOfYear(subDays(new Date(), 365));
        end = endOfYear(subDays(new Date(), 365));
        break;
      case "custom":
        break;
      default:
        break;
    }
   
    if (value === "today" || value === "yesterday") {
        setTitleDate(format(start, 'MMM dd, yyyy'));
      } else {
        setTitleDate(`${format(start, 'MMM dd')} - ${format(end, 'dd, yyyy')}`);
      }
  
  
    const startDate = formatDate(start);
    const endDate = formatDate(end);
    dispatch(action(startDate, endDate));
  };
  const formatKeyToReadableText = (key) => {
    if (
      key === "thisYear" ||
      key === "thisMonth" ||
      key === "thisWeek" ||
      key === "today" ||
      key === "yesterday" ||
      key === "lastMonth" ||
      key === "lastWeek" ||
      key === "lastYear"
    ) {
      return key
        .split(/(?=[A-Z])/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    } else {
      return "Custom";
    }
  };
  useEffect(() => {
    
    handleSelectChange("thisMonth");
  }, []);

  const handleAcceptClick = () => {
    try {
        setIsCustomDrawerOpen(false);
        setCustomRange(selectedRange);
        // Set the title date here for custom range
        setTitleDate(`${format(new Date(selectedRange[0]), 'MMM dd')} - ${format(new Date(selectedRange[1]), 'dd, yyyy')}`);
    } catch (error) {
        console.log(error)
    }
  };

  const handleRangeChange = (dates, dateStrings) => {
    setSelectedRange(dateStrings);
  };

  useEffect(() => {
    if (customRange.length === 2) {
      dispatch(action(customRange[0], customRange[1]));
    }
  }, [customRange]);

  const handleMenuClick = (e) => {
    handleSelectChange(e.key);
  };
  const menu = (
    <Menu onClick={handleMenuClick}>
      {options.map((option) => (
        <Menu.Item key={option}>{formatKeyToReadableText(option)}</Menu.Item>
      ))}
    </Menu>
  );

  return (
    <>
      <Drawer
        title="Select custom range"
        placement="right"
        closable={true}
        onClose={() => setIsCustomDrawerOpen(false)}
        visible={isCustomDrawerOpen}
      >
        <RangePicker onChange={handleRangeChange} />
        <Button onClick={handleAcceptClick}>Accept</Button>
      </Drawer>
      <div className="d-flex justify-content-end">
      <div style={{ marginTop: 40 }}>
          <Text className="text-dark marginr-1" style={{fontSize:22}}>{titleDate}</Text>
        </div>
        <div className="col-2 " style={{ marginTop: 40 }}>
          <Dropdown overlay={menu}>
            <Button className="w-100">
              <i className="fas fa-calendar marginr-1"></i> {selectValue}{" "}
              <i className="fas fa-angle-down marginl-1"></i>
            </Button>
          </Dropdown>
        </div>
       
      </div>
     
    </>
  );
};


export default CardPoint
