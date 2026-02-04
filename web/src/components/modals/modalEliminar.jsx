import React from "react";
import {Button,Modal} from "react-bootstrap/";
function modal({eliminando,IDModPost,show,setShow}) {
    function eliminarsend(){
        eliminando(IDModPost)
        setShow(false)
    }
  return (
    <>
    
  <Modal show={show} onHide={() =>setShow(false)}>
        <Modal.Header closeButton>Aviso</Modal.Header>
        <Modal.Body>
       Estas seguro de que quieres eliminarlo?
        </Modal.Body>
        <Modal.Footer>
        <button className="btn-secondary-osmed" onClick={() =>setShow(false)}>
            Cancelar
          </button>
          <button className="btn-primary-osmed" onClick={eliminarsend}>
            Aceptar
          </button>
        </Modal.Footer>
      </Modal>
      </>
  );
}

export default modal
