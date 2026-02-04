import React, { useState, useEffect } from "react";
import { Modal, Image } from "react-bootstrap/";
import Osmerito from "../../assets/img/osmerito.gif";

function MyModal({ show, setShow }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = new window.Image(); // Utilizamos la clase Image del navegador
    img.onload = () => setImageLoaded(true);
    img.src = Osmerito;
  }, []);

  return (
    <>
      <Modal
        style={{ backgroundColor: "transparent" }}
        dialogClassName="transparent-modal"
        centered
        backdrop="static"
        keyboard={false}
        show={show}
        onHide={() => setShow(false)}
      >
        <Modal.Body className="transparent-modal-body">
          <div className="d-flex justify-content-center">
            <div>
              {imageLoaded && <Image src={Osmerito} fluid />}
              <div className="d-flex justify-content-center mt-3">
                <p className="loading-message text-white">Cargando...</p>
              </div>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default MyModal;
