import React, { Component,useState } from "react";
import axios from "axios";
import {Modal,Button,Form,Row} from "react-bootstrap/";
import Modalmensaje from "./modalMensaje"
import Cookies from 'js-cookie';
function modal({show,setShow,aceptarauth_click}) {
    const [nombre,setNombre] = useState("")
    const [pass,setPass] = useState("")
    const [showmsg,setShowmsg] = useState(false)
    const [validated, setValidated] = useState(false);
    const [msg,setMsg] = useState("")
    const btn_aceptar = (event) => {
      if (true) {
      checkUser()
      } else {
        setMsg("Ingrese correctamente los campos");
        
      }
      setValidated(true);
    };
    function checkUser(){
      var parametros = {
        token: "abc",
        opcion: "AUTH",
        data: [nombre,pass],
      };
  
      var csrftoken = Cookies.get('csrftoken');
      axios
        .post("/api/app/admin/usuarios/", parametros, {
          headers: {
            "X-CSRFToken": csrftoken,
          },
        })
        .then(function (res) {
          if(res.data.data.value=="1"){
            aceptarauth_click()
          }else{
            setMsg(res.data.data.msg)
            setShowmsg(true)
          }
        })
        .catch(function (err) {
          console.log(err);
        });
    }
  return (
    <>
    <Modalmensaje msg={msg} show={showmsg} setShow={setShowmsg} />
  <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>Ingrese los datos</Modal.Header>
        <Form className="mt-3" >
        <Modal.Body>
       
         
         <div className="marginb-5">
     
       <Row className="mb-3">
       <Form.Group   >
           <Form.Label>Nombre de usuario</Form.Label>
           <Form.Control
             required
             type="text"
             maxLength={25}
             placeholder="Ingrese el nombre de usuario"
             value={nombre}
             onChange={(ev) => setNombre(ev.target.value)}
             
           />
           <Form.Control.Feedback type="invalid">
             Ingrese correctamente el nombre
           </Form.Control.Feedback>
         </Form.Group>
         </Row>
         <Row className="mb-3">
         <Form.Group > 
           <Form.Label>Contraseña</Form.Label>
           <Form.Control
           required
             type="password"
             value={pass}
             onChange={(ev) => setPass(ev.target.value)}
             placeholder="Ingrese la contraseña de usuario"
             maxLength={50}
             
           />
            <Form.Control.Feedback type="invalid">
             Ingrese correctamente la contraseña
           </Form.Control.Feedback>
         </Form.Group>
        
         </Row>

         
         </div>

      
        </Modal.Body>
        <Modal.Footer>
        <button className="btn-secondary-osmed"onClick={() => setShow(false)}>
            Cancelar
          </button>
          <button className="btn-primary-osmed"onClick={btn_aceptar}>
            Aceptar
          </button>
        </Modal.Footer>
        </Form>
      </Modal>
      </>
  );
}

export default modal
