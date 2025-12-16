const cron = require("node-cron");
const { loanModel } = require("../models/loanModel");
const { signupModel } = require("../models/signupModel");
const { transactionModel } = require("../models/transactionModel");
const { sendEmail } = require("../utilis/mail");


cron.schedule("0 0 * * *", async () => {
  console.log("Running monthly loan deduction job...");

  const today = new Date();

  const loans = await loanModel.find({
    status: "approved",
    nextPaymentDate: { $lte: today },
    remainingBalance: { $gt: 0 }
  });

  for (let loan of loans) {
    const user = await signupModel.findById(loan.user);
    if (!user) continue;

    if (user.balance < loan.monthlyPayment) {
      console.log(`User ${user._id} does not have enough balance`);
      continue;
    }

    user.balance -= loan.monthlyPayment;
    await user.save();

    loan.remainingBalance -= loan.monthlyPayment;
    loan.paymentsMade += 1;

    loan.nextPaymentDate.setMonth(loan.nextPaymentDate.getMonth() + 1);

    if (loan.remainingBalance <= 0) {
      loan.status = "completed";
    }

    await loan.save();

    await transactionModel.create({
      user: loan.user,
      sender: loan.user,
      receiver: "BANK_SYSTEM",
      type: "loan-monthly-deduction",
      amount: loan.monthlyPayment,
      description: "Monthly Loan Payment Deducted",
      status: "completed",
    });

    await sendEmail(
        user.email,
        "Monthly Loan Payment Deducted",
        `Your account has been charged $${loan.monthlyPayment} for your monthly loan repayment`
    )

    console.log(`Monthly payment deducted for Loan ${loan._id}`);
  }
});
