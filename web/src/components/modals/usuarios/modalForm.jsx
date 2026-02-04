import { Modal,Form,Col,Row,Nav,Button,Tab } from "react-bootstrap/";
import { actionAgregar } from "../../../redux/actions/form/form";
import { useDispatch,connect } from "react-redux";
import { useParams } from "react-router";
import { useState } from "react";
import FormInfo from "../../forms/usuarios/formInfo"
import { useEffect } from "react";
import Toast from "../../toasts/toast"
function modal({ show, setShow, img,dataInfo,dataPrivilegios,callback }) {
  console.log(dataPrivilegios)
  const [dataForm, setDataForm] = useState(dataInfo);
  const [privilegios, setPrivilegios] = useState(dataPrivilegios);
  const [msg,setMsg] = useState("")
  const [showToast,setShowToast] = useState(false)
  const dispatch = useDispatch();
  let { id } = useParams();
  const [validated, setValidated] = useState({
    password:"none",
    nombre:"none",
  });
  const callbackAgregando = (msg) => {
    callback()
    setShow(false);
    setMsg(msg);
    setShowToast(true);
  };
  const callbackAgregandoError = (msg) => {
    setMsg(msg);
    setShowToast(true);
  };
  const callbackEditando = () => {
    setMsg(res.data.msg);
    setShow(false);
    setShowToast(true);
  };
  const callbackEditandoError = () => {
    setMsg(res.data.msg);
    setShow(true);
  };
  function agregando() {
    
    var parametros = {
      data: dataForm,
      dataPrivilegios: privilegios,
      img: img,
      clave:"",
    };
    dispatch(
      actionAgregar(parametros, callbackAgregando, callbackAgregandoError)
    );
  }
  function editando() {
    var parametros = {
      data: dataForm,
    };
    dispatch(
      actionAgregar(parametros, callbackEditando, callbackEditandoError)
    );
  }
  const validacion = () => {
   
    try{
      let check = true;
      let newdata = { ...validated };
      
      for (const key in validated) {
        if (dataForm[key].trim().length === 0) {
          newdata[key] = "block";
          check = false;
        }
      }
    
      setValidated(newdata);
      return check;
    }catch(e){
      console.log(e)
    }
  };
  
  const handleSubmit = (event) => {
    if (validacion()) {
    
      if (typeof id != "undefined") {
        editando();
      } else {
        agregando();
      }
    } else {
      setMsg("Ingrese correctamente los campos");
      setShowToast(true);
    }
  };

  function restablecer() {
    setDataForm(dataInfo);
  }
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let send = URL.createObjectURL(file);
      //onStateData(send, 2);
    };
  };
  useEffect(() => {
    if(typeof dataInfo !="undefined"){
      setDataForm(dataInfo);

    }


  }, [dataInfo]);
  useEffect(() => {
    if(typeof dataPrivilegios !="undefined"){
     
      setPrivilegios(dataPrivilegios)
    }


  }, [dataPrivilegios]);
  return (
    <>
    <Toast msg={msg} setShow={setShowToast} show={showToast}/>

    <Modal show={show} onHide={() => setShow(false)} size="xl">
      <Modal.Header closeButton>
        <div className="d-flex mt-2 div_title">
          <i className="fas fa-info-circle  marginr-1"></i>
          <h5>Informacion</h5>
        </div>
      </Modal.Header>
      <Modal.Body>
        <Form className="mt-3">
         
          
          <div className="marginb-5">
            <div className="d-flex  justify-content-end">
              <div className="mb-3 d-flex justify-content-end">
                <Button
                  variant="secondary"
                  onClick={restablecer}
                  className="marginr-2 boton-icon"
                >
                  <i className="fas fa-undo"></i>
                  Restablecer
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleSubmit}
                  className="boton-icon"
                >
                  <i className="fas fa-plus"></i>
                  Guardar
                </Button>
              </div>
            </div>
            <Tab.Container id="left-tabs-example" defaultActiveKey="info">
              <Row>
                <Col sm={3}>
                  <Nav variant="pills" className="flex-column">
                    <Nav.Item>
                      <Nav.Link eventKey={"info"}>
                        <i className={"fas fa-info-circle marginr-icon"}></i>
                        Informacion
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey={"ilustracion"}>
                        <i className={"fas fa-image marginr-icon"}></i>
                        Ilustracion
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey={"privilegios"}>
                        <i className={"fas fa-lock marginr-icon"}></i>
                        Privilegios
                      </Nav.Link>
                    </Nav.Item>
               
                  </Nav>
                </Col>
                <Col sm={9}>
                  <Tab.Content>
                    <Tab.Pane eventKey="info">
                      <FormInfo
                        validated={validated}
                        data={dataForm}
                        setData={setDataForm}
                      />
                    </Tab.Pane>
                    <Tab.Pane eventKey="ilustracion">
                      <div className="d-block ">
                        <div className="col-md-4 btn-tableinput ">
                          <input
                            type="file"
                            name="img"  
                            className="file cajafiles"
                            accept="  .gif,.jfif,.jpeg,.jpg,.png"
                            onChange={handleImageChange}
                          />
                        </div>

                        {img && (
                          <img
       
                            className=" p-3"
                            style={{ height: "280px" }}
                            src={img}
                            alt="selected"
                          />
                        )}
                      </div>
                    </Tab.Pane>
                    <Tab.Pane eventKey="privilegios">
                   
                    </Tab.Pane>
 
                  </Tab.Content>
                </Col>
              </Row>
            </Tab.Container>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
    </>
  );
}
const mapStateToProps = (state) => ({
  img: state.catalogos.details.img,
  dataInfo: state.catalogos.details.info,
  dataPrivilegios: state.catalogos.details.recetas,
});

export default connect(mapStateToProps)(modal);
