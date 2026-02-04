import React, { useEffect, useState } from "react";
import {Modal,Form,Row,Col,Toast,ToastContainer} from "react-bootstrap/";
import { useParams } from "react-router-dom";
import Cardprivilegios from "../../components/dashboard/cardprivilegios";
import "../../assets/css/modal.css";
function modal({show,setShow,data,ini}) { 
    const [dataform,setDataform] = useState(data)
    const [showtoast, setShowToast] = useState(false);
    const [msg,setMsg] = useState("")
    let { id } = useParams();
    const onStatedata = (value, pos,index) => {
        console.log(dataform)
        let newdata = [...dataform];
        console.log(pos)
        console.log(value)
        newdata[1][pos] = value;
        setDataform(newdata);
      };
     
    const handleSubmit = (event) => {
        editando();
      };
      function restablecer(){
        setDataform(data);
    
    }
    function editando(){
        var parametros = {
          token: "abc",
          opcion: "EDITANDO_PRIV",
          data: dataform[1],
          clave:id
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
              ini()
              setShow(false)
              setMsg(res.data.msg)
              setShowToast(true)
            }
            if (res.status == 202) {
           
            
            }
            
            
          })
          .catch(function (err) {
           
       
          });
      }
      useEffect(() => {
        setDataform(data)
        
      }, []);
    
  return (
    <>
     <Row>
        <ToastContainer position="bottom-end" className="p-3">
          <Toast
            onClose={() => setShowToast(false)}
            show={showtoast}
            delay={3000}
            autohide
          >
            <Toast.Header>
             
              <strong className="me-auto">Don Simon</strong>
              <small>11 mins ago</small>
            </Toast.Header>
            <Toast.Body>{msg}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Row>
  <Modal show={show} onHide={ () => setShow(false)} size="xl"  >
  <Modal.Header closeButton>     
        <div className="d-flex mt-2 div_title">
                    <i className="fas fa-info-circle  marginr-1"></i>
                    <h5>Informacion</h5>
                  </div></Modal.Header>
        <Modal.Body>
        <Form className="mt-3" >
          
          <div className="marginb-5">
        <div className="d-flex  justify-content-end">

        <div className="mb-3 d-flex justify-content-end">
          <button  onClick={restablecer} className="marginr-2 boton-icon btn btn-secondary-osmed" >
            <i className="fas fa-undo"></i>
            Restablecer
            </button>          
          <button  type="button" onClick={handleSubmit} className="boton-icon btn btn-primary-osmed"  >
          <i className="fas fa-plus"></i>
            Guardar
            </button>
        </div>
        </div>
        <Cardprivilegios data={dataform} switches={true} onStatedata={onStatedata} />
        
          </div>

        </Form>
      
        </Modal.Body>
       
      </Modal>
      </>
  );
}

export default modal
