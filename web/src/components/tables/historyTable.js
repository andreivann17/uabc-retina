import React,{ useEffect,useState }  from 'react';
import { Space, Table, Tag } from 'antd';
import Header from "../../components/navigation/header.jsx";
import Contenido from "../../components/navigation/content.jsx";
import { useDispatch, connect } from "react-redux";
const token = localStorage.getItem("tokends");
const columns = [
    {
      title: '#',
      dataIndex: 'count',
      key: 'count',
      render: (text) => <a>{text}</a>,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (text) => <a>{text}</a>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: 'Section',
      dataIndex: 'section',
      key: 'section',
    },
  
   
  ];
function Home({data}) {

  useEffect(() => {
    // dispatch(actionDivisas())
  }, []);
  return (
    <>
      {token != null && (
        <>
        
          <Header title={""} icon={"fas fa-utensils marginr-1 "} />
          <Contenido title={""} icon={"fas fa-utensils marginr-1 "} />
          <div className="Panel_Contenido  marginb-5">
       
            <div className="mt-3">
            <Table columns={columns} dataSource={data} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

const mapStateToProps = (state) => ({
    data : state.history.data ?? []
});

export default connect(mapStateToProps)(Home);
