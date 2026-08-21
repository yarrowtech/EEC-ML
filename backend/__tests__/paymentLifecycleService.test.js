const mockFeeInvoice = {
  findOne: jest.fn(),
};
const mockFeePayment = {
  aggregate: jest.fn(),
};

jest.mock('../models/FeeInvoice', () => mockFeeInvoice);
jest.mock('../models/FeePayment', () => mockFeePayment);
jest.mock('../models/Payment', () => ({}));
jest.mock('../models/PaymentAudit', () => ({}));
jest.mock('../utils/paymentGatewayService', () => ({
  buildTransactionId: jest.fn(() => 'RZP-TEST'),
}));

const { syncInvoiceFromReceipts } = require('../services/paymentLifecycleService');

describe('payment lifecycle invoice synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sums stored fee receipts using the schema-backed school and invoice fields', async () => {
    const invoice = {
      totalAmount: 12000,
      discountAmount: 0,
      paidAmount: 0,
      balanceAmount: 12000,
      status: 'due',
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockFeePayment.aggregate.mockResolvedValue([{ _id: null, paidAmount: 5000 }]);
    mockFeeInvoice.findOne.mockResolvedValue(invoice);

    await syncInvoiceFromReceipts({
      organizationId: 'organization-1',
      schoolId: 'school-1',
      feeId: 'invoice-1',
    });

    expect(mockFeePayment.aggregate).toHaveBeenCalledWith([
      { $match: { schoolId: 'school-1', invoiceId: 'invoice-1' } },
      { $group: { _id: null, paidAmount: { $sum: '$amount' } } },
    ]);
    expect(mockFeeInvoice.findOne).toHaveBeenCalledWith({
      _id: 'invoice-1',
      schoolId: 'school-1',
    });
    expect(invoice).toEqual(expect.objectContaining({
      paidAmount: 5000,
      balanceAmount: 7000,
      status: 'partial',
    }));
    expect(invoice.save).toHaveBeenCalled();
  });
});
