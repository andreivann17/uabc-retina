import React, { useState } from "react";
import {Modal,Row,Toast,ToastContainer} from "react-bootstrap/";

function modal({show,setShow,data}) {
  const [showmensaje,setShowMensaje] = useState(false)  
  const [msg,setMsg] = useState("")
  const handleClose = () => setShow(false);
  return (
    <>
      <Row>
        <ToastContainer position="bottom-end" className="p-3">
          <Toast
            onClose={() => setShowMensaje(false)}
            show={showmensaje}
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
  <Modal show={show} onHide={handleClose}  size="lg">
  <Modal.Header closeButton>     

  <div className="d-flex mt-2 div_title">
  <i className="fas fa-file  marginr-1"></i>
  <h5>Detalles</h5>
</div>
       
                  </Modal.Header>
        <Modal.Body>
       <table id="miDiv" className="table">
            {typeof data !== "undefined" && (
              <tbody>
                <tr>
                  <td>
                    <div>
                      <small
                        style={{ fontSize: "16px" }}
                        className="text-white d-block mb-1"
                      >
                        {data[0]}
                      </small>
                      <small
                        style={{ fontSize: "12px" }}
                        className="text-muted d-block"
                      >
                        Clave
                      </small>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div>
                      <small
                        style={{ fontSize: "16px" }}
                        className="text-white d-block mb-1"
                      >
                        {data[1]}
                      </small>
                      <small
                        style={{ fontSize: "12px" }}
                        className="text-muted d-block"
                      >
                        Nombre
                      </small>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div>
                      <small
                        style={{ fontSize: "16px" }}
                        className="text-white d-block mb-1"
                      >
                        {data[2]}
                      </small>
                      <small
                        style={{ fontSize: "12px" }}
                        className="text-muted d-block"
                      >
                        IP
                      </small>
                    </div>
                  </td>
                </tr>
             
                <tr>
                  <td>
                    <div>
                      <small
                        style={{ fontSize: "16px" }}
                        className="text-white d-block mb-1"
                      >
                        {data[4]}
                      </small>
                      <small
                        style={{ fontSize: "12px" }}
                        className="text-muted d-block"
                      >
                       Usuario
                      </small>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div>
                      <small
                        style={{ fontSize: "16px" }}
                        className="text-white d-block mb-1"
                      >
                        {data[3]}
                      </small>
                      <small
                        style={{ fontSize: "12px" }}
                        className="text-muted d-block"
                      >
                       Fecha de Creacion
                      </small>
                    </div>
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </Modal.Body>
       
      </Modal>
      </>
  );
}

export default modal
