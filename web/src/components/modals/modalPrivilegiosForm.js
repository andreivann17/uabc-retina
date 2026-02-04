import React, { useEffect, useState } from "react";
import {Modal,Form,Button,Col} from "react-bootstrap/";
import Cardprivilegios from "../dashboard/cardprivilegios";
import "../../assets/css/modal.css";
import axios from "axios";
import Cookies from "js-cookie";
function modal({show,setShow,data,claveurl}) { 
    const [dataprivform,setDataprivform] = useState(data)
    const handleSubmit = (event) => {
      editando();
       
      };
      function restablecer(){
        setDataprivform(data);
    
    }
    function editando(){
        var parametros = {
          token: "abc",
          opcion: "EDITANDO_PRIV",
          data: dataprivform,
          clave:claveurl
        };
    
        var csrftoken = Cookies.get('csrftoken');
        axios
          .patch("/api/app/admin/usuariosform/", parametros, {
            headers: {
              "X-CSRFToken": csrftoken,
            },
          })
          .then(function (res) {
            
            if (res.status == 200) {
              if(typeof handleClose !== "undefined"){
                ini()
                handleClose()
              }
            
            }
            if (res.status == 202) {
           
            
            }
            setMsg(res.data.msg)
            setShow(true)
            
          })
          .catch(function (err) {
           
       
          });
      }
      useEffect(() => {
        setDataprivform(data)
        
      }, []);
      console.log(dataprivform[0])
  return (
    <>
  <Modal show={show} onHide={ () => setShow(false)} size="xl"  >
  <Modal.Header closeButton>     
        <div className="d-flex mt-2 div_title">
                    <i className="fas fa-info-circle  marginr-1"></i>
                    <h5>Informacion</h5>
                  </div></Modal.Header>
        <Modal.Body>
        <Form  className="mt-3" >
          
          <div className="marginb-5">
        <div className="d-flex  justify-content-end">

        <div className="mb-3 d-flex justify-content-end">
          <button  onClick={restablecer} className="marginr-2 boton-icon btn-secondary-osmed" >
            <i className="fas fa-undo"></i>
            Restablecer
            </button>          
          <button type="button" onClick={handleSubmit} className="boton-icon btn-primary-osmed"  >
          <i className="fas fa-plus"></i>
            Guardar
            </button>
        </div>
        </div>
       
              </div>
        </Form>
      
        </Modal.Body>
       
      </Modal>
      </>
  );
}

export default modal
