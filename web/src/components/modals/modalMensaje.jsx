import React from "react";
import { Modal, Button } from "antd";

function modal({ show, setShow, msg }) {
  return (
    <>
      <Modal
        title="Notice"
        visible={show}
        onCancel={() => setShow(false)}
        footer={[
          <Button key="cancel" onClick={() => setShow(false)}>
            Cancel
          </Button>,
          <Button key="submit" className="custom-button" type="primary" onClick={() => setShow(false)}>
            Accept
          </Button>,
        ]}
      >
       <div className="margint-2">
       {msg}
       </div>
      </Modal>
    </>
  );
}

export default modal;
