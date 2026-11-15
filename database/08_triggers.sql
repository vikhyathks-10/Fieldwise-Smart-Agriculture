USE `smartagriculturedb`;
DELIMITER $$

CREATE TRIGGER `AfterFarmerInsert`
AFTER INSERT ON `Farmer`
FOR EACH ROW
BEGIN
  INSERT INTO `Farmer_Audit` (Farmer_ID, Farmer_Name, Action_Type, Old_Values, New_Values)
  VALUES (
    NEW.Farmer_ID, NEW.Name, 'INSERT', NULL,
    JSON_OBJECT('Farmer_ID', NEW.Farmer_ID, 'Name', NEW.Name, 'Phone', NEW.Phone, 'Email', NEW.Email, 'Address', NEW.Address)
  );
END$$

CREATE TRIGGER `AfterFarmerUpdate`
AFTER UPDATE ON `Farmer`
FOR EACH ROW
BEGIN
  INSERT INTO `Farmer_Audit` (Farmer_ID, Farmer_Name, Action_Type, Old_Values, New_Values)
  VALUES (
    NEW.Farmer_ID, NEW.Name, 'UPDATE',
    JSON_OBJECT('Farmer_ID', OLD.Farmer_ID, 'Name', OLD.Name, 'Phone', OLD.Phone, 'Email', OLD.Email, 'Address', OLD.Address),
    JSON_OBJECT('Farmer_ID', NEW.Farmer_ID, 'Name', NEW.Name, 'Phone', NEW.Phone, 'Email', NEW.Email, 'Address', NEW.Address)
  );
END$$

CREATE TRIGGER `AfterFarmerDelete`
AFTER DELETE ON `Farmer`
FOR EACH ROW
BEGIN
  INSERT INTO `Farmer_Audit` (Farmer_ID, Farmer_Name, Action_Type, Old_Values, New_Values)
  VALUES (
    OLD.Farmer_ID, OLD.Name, 'DELETE',
    JSON_OBJECT('Farmer_ID', OLD.Farmer_ID, 'Name', OLD.Name, 'Phone', OLD.Phone, 'Email', OLD.Email, 'Address', OLD.Address),
    NULL
  );
END$$

DELIMITER ;
