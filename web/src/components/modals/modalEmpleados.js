import React from "react";
import {Modal,Row,Col,Tab,Nav} from "react-bootstrap/";
import Tablemenu from "../tables/table_menu"
import Tablerecetas from "../tables/table_cajerorecetas"

function modal({show,setShow,data,datamaster,pos,setDataMaster}) {
    const handleClose = () => setShow(false);
  
  return (
    <>
  <Modal show={show} onHide={handleClose} size="xl">
        <Modal.Header closeButton>Detalles</Modal.Header>
        <Modal.Body>
        <Tab.Container id="left-tabs-example" defaultActiveKey="info">
      <Row>
        <Col sm={3}>
          <Nav variant="pills" className="flex-column">
          <Nav.Item>
              <Nav.Link eventKey="info"><i className="fas fa-info-circle marginr-icon"></i>Informacion</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="recetario"><i className="fas fa-hamburger marginr-icon"></i>Recetario</Nav.Link>
            </Nav.Item>
         
          </Nav>
        </Col>
        <Col sm={9}>
          <Tab.Content>
          <Tab.Pane eventKey="info">
          <Tablemenu data={data}/>
              </Tab.Pane>
              <Tab.Pane eventKey="recetario">
              <Tablerecetas data={datamaster}   pos={pos} setData={setDataMaster}/>
              </Tab.Pane>
         
          </Tab.Content>
        </Col>
      </Row>
    </Tab.Container>
        
        </Modal.Body>
        
      </Modal>
      </>
  );
}

export default modal
