export interface Schedule {
  productName: string;
  environmentName: string;
  startDateTime: Date;
  endDateTime: Date;
  personInChargeId: string;
  personInChargeName: string;
  remarks: string;
}
