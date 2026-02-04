import React, { useMemo, useImperativeHandle } from "react";
import { notification } from "antd";
const Context = React.createContext({
  name: "Default",
});
const App = React.forwardRef(({}, ref) => {
  const [api, contextHolder] = notification.useNotification();
  const openNotification = (placement,msg,type) => {
    api[type]({
      message: "",
      description: (
        <Context.Consumer>{({ name }) => msg}</Context.Consumer>
      ),
      placement,
    });
  };
  const contextValue = useMemo(
    () => ({
      name: "Ant Design",
    }),
    []
  );
  useImperativeHandle(ref, () => ({
    openNotification: (placement,msg,type) => {
      openNotification(placement,msg,type);
    },
  }));
  return (
    <Context.Provider value={contextValue}>{contextHolder}</Context.Provider>
  );
});
export default App;
