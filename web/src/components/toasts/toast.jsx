import {Toast,ToastContainer,Row} from 'react-bootstrap/'
import logo from "../../assets/img/logo.png";
function toast({show,setShow,msg}) {
  return (
    <Row>
    <ToastContainer position="bottom-end" className="p-3">
    <Toast onClose={() => setShow(false)} show={show} delay={3000} autohide>
      <Toast.Header>
        <img
          src={logo}
          className="rounded me-2"
          style={{width:"20px"}}
          alt=""
        />
        <strong className="me-auto">UABC Retina</strong>
   
      </Toast.Header>
      <Toast.Body>{msg}</Toast.Body>
    </Toast>
  </ToastContainer>
  
</Row>
  );
}

export default toast
