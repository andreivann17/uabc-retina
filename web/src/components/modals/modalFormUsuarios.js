import React, { useState } from "react";
import {Modal} from "react-bootstrap/";
import Form from "../forms/form_usuarios";
import Modalmensaje from "./modalMensaje";


function modal({show,setShow,data,ini,option,id,dataprivilegios}) {
  const [showmensaje,setShowMensaje] = useState(false)  
  const [msg,setMsg] = useState("")
  const handleClose = () => setShow(false);
    
  return (
    <>
    <Modalmensaje show={showmensaje} setShow={setShowMensaje} msg={msg}/>
  <Modal show={show} onHide={handleClose}  size="xl">
  <Modal.Header closeButton>     
        <div className="d-flex mt-2 div_title">
                    <i className="fas fa-info-circle  marginr-1"></i>
                    <h5>Informacion</h5>
                  </div></Modal.Header>
        <Modal.Body>
       <Form   dataprivilegios={dataprivilegios} setShow={setShowMensaje} setMsg={setMsg} claveurl={id} handleClose={handleClose} data={data} ini={ini} option={option}/>
        </Modal.Body>
       
      </Modal>
      </>
  );
}

export default modal
