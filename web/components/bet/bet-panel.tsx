import {
  ChevronDownIcon,
  LockClosedIcon,
  LockOpenIcon,
  XIcon,
} from '@heroicons/react/outline'
import clsx from 'clsx'
import { capitalize, uniq } from 'lodash'
import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'

import {
  isBinaryMulti,
  MarketContract,
  MAX_CPMM_PROB,
  MAX_STONK_PROB,
  MIN_CPMM_PROB,
  MIN_STONK_PROB,
  MultiContract,
} from 'common/contract'
import {
  formatLargeNumber,
  formatMoney,
  formatOutcomeLabel,
  formatPercent,
  formatWithToken,
} from 'common/util/format'
import { api, APIError } from 'web/lib/api/api'
import { firebaseLogin } from 'web/lib/firebase/users'
import { Col } from '../layout/col'
import { Row } from '../layout/row'
import { AmountInput, BuyAmountInput } from '../widgets/amount-input'
import { LimitBet } from 'common/bet'
import { TRADE_TERM } from 'common/envs/constants'
import {
  getVerificationStatus,
  PROMPT_USER_VERIFICATION_MESSAGES,
} from 'common/gidx/user'
import { getFormattedMappedValue } from 'common/pseudo-numeric'
import { getStonkDisplayShares, STONK_NO, STONK_YES } from 'common/stonk'
import {
  getTierIndexFromLiquidity,
  getTierIndexFromLiquidityAndAnswers,
} from 'common/tier'
import { floatingEqual } from 'common/util/math'
import { removeUndefinedProps } from 'common/util/object'
import { InfoTooltip } from 'web/components/widgets/info-tooltip'
import { useFocus } from 'web/hooks/use-focus'
import { useIsAdvancedTrader } from 'web/hooks/use-is-advanced-trader'
import { usePrivateUser, useUser } from 'web/hooks/use-user'
import { track, withTracking } from 'web/lib/service/analytics'
import { isAndroid, isIOS } from 'web/lib/util/device'
import { WarningConfirmationButton } from '../buttons/warning-confirmation-button'
import { getAnswerColor } from '../charts/contract/choice'
import { LocationMonitor } from '../gidx/location-monitor'
import { ChoicesToggleGroup } from '../widgets/choices-toggle-group'
import LimitOrderPanel from './limit-order-panel'
import { MoneyDisplay } from './money-display'
import { OrderBookPanel, YourOrders } from './order-book'
import { YesNoSelector } from './yes-no-selector'
import { sliderColors } from '../widgets/slider'
import {
  useContractBets,
  useUnfilledBetsAndBalanceByUserId,
} from 'client-common/hooks/use-bets'
import { useIsPageVisible } from 'web/hooks/use-page-visible'
import { CandidateBet } from 'common/new-bet'
import { APIParams } from 'common/api/schema'
import { Button } from '../buttons/button'
import { usePersistentLocalState } from 'web/hooks/use-persistent-local-state'
import { getLimitBetReturns, MultiBetProps } from 'client-common/lib/bet'
import { Tooltip } from '../widgets/tooltip'
import { useIsMobile } from 'web/hooks/use-is-mobile'
import { ShareBetModal } from './share-bet'
import { Bet } from 'common/bet'
import { LuShare } from 'react-icons/lu'
import { useEvent } from 'client-common/hooks/use-event'
import { calculateCpmmAmountToBuyShares } from 'common/calculate-cpmm'

const WAIT_TO_DISMISS = 3000
export type BinaryOutcomes = 'YES' | 'NO' | undefined
type BuyPanelProps = {
  contract: MarketContract
  multiProps?: MultiBetProps
  onBuySuccess?: () => void
  initialOutcome?: BinaryOutcomes
  location?: string
  replyToCommentId?: string
  feedReason?: string
  pseudonym?: {
    YES: {
      pseudonymName: string
      pseudonymColor: keyof typeof sliderColors
    }
    NO: {
      pseudonymName: string
      pseudonymColor: keyof typeof sliderColors
    }
  }
  children?: React.ReactNode
  alwaysShowOutcomeSwitcher?: boolean
  className?: string
}

export function BuyPanel(
  props: BuyPanelProps & {
    inModal: boolean
  }
) {
  const {
    contract,
    initialOutcome,
    location = 'bet panel',
    inModal,
    alwaysShowOutcomeSwitcher,
    children,
    pseudonym,
    className,
  } = props

  const isPseudoNumeric = contract.outcomeType === 'PSEUDO_NUMERIC'
  const isStonk = contract.outcomeType === 'STONK'

  const [outcome, setOutcome] = useState<BinaryOutcomes>(initialOutcome)
  const [isPanelBodyVisible, setIsPanelBodyVisible] = useState(false)
  const cancelDismissTimerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (initialOutcome) {
      setOutcome(initialOutcome)
      setIsPanelBodyVisible(true)
    }
  }, [initialOutcome])

  function onOutcomeChoice(choice: 'YES' | 'NO') {
    if (outcome === choice && !initialOutcome) {
      setOutcome(undefined)
      setIsPanelBodyVisible(false)
    } else {
      track('bet intent', {
        location,
        option: outcome,
        token: contract.token,
        boosted: contract.boosted,
      })

      setOutcome(choice)
      setIsPanelBodyVisible(true)
      // Cancel dismiss timer if user is switching outcomes
      if (cancelDismissTimerRef.current) {
        cancelDismissTimerRef.current()
      }
    }
  }
  return (
    <Col>
      {!isPanelBodyVisible && (
        <Col>
          <Row className={clsx('mb-2 w-full items-center gap-2')}>
            <YesNoSelector
              className="flex-1"
              btnClassName="flex-1 px-2 sm:px-6"
              selected={outcome}
              highlight
              onSelect={(choice) => {
                onOutcomeChoice(choice)
              }}
              yesLabel={
                isPseudoNumeric ? 'HIGHER' : isStonk ? STONK_YES : 'YES'
              }
              noLabel={isPseudoNumeric ? 'LOWER' : isStonk ? STONK_NO : 'NO'}
              includeWordBet={!isStonk}
            />
          </Row>
        </Col>
      )}
      {isPanelBodyVisible && (
        <BuyPanelBody
          {...props}
          className={clsx('-mx-2 sm:mx-0', className)}
          outcome={outcome}
          setOutcome={setOutcome}
          onClose={
            inModal || alwaysShowOutcomeSwitcher
              ? undefined
              : () => {
                  setIsPanelBodyVisible(false)
                  if (initialOutcome == undefined) {
                    setOutcome(undefined)
                  }
                }
          }
          pseudonym={pseudonym}
          cancelDismissTimerRef={cancelDismissTimerRef}
        >
          {children}
        </BuyPanelBody>
      )}
    </Col>
  )
}

export const BuyPanelBody = (
  props: BuyPanelProps & {
    outcome?: BinaryOutcomes
    setOutcome: (outcome: 'YES' | 'NO') => void
    onClose?: () => void
    cancelDismissTimerRef?: React.MutableRefObject<(() => void) | null>
  }
) => {
  const {
    contract,
    multiProps,
    outcome,
    setOutcome,
    alwaysShowOutcomeSwitcher,
    onBuySuccess,
    location = 'bet panel',
    onClose,
    replyToCommentId,
    feedReason,
    className,
    children,
    cancelDismissTimerRef,
  } = props

  const user = useUser()
  const privateUser = usePrivateUser()
  const liquidityTier =
    'answers' in contract
      ? getTierIndexFromLiquidityAndAnswers(
          contract.totalLiquidity,
          contract.answers.length
        )
      : getTierIndexFromLiquidity(contract.totalLiquidity)

  const { unfilledBets: allUnfilledBets, balanceByUserId } =
    useUnfilledBetsAndBalanceByUserId(
      contract.id,
      (params) => api('bets', params),
      (params) => api('users/by-id/balance', params),
      useIsPageVisible
    )

  const unfilledBetsMatchingAnswer = allUnfilledBets.filter(
    (b) => b.answerId === multiProps?.answerToBuy?.id
  )

  const isBinaryMC = isBinaryMulti(contract)
  const binaryMCColors = isBinaryMC
    ? (contract as MultiContract).answers.map(getAnswerColor)
    : undefined

  const binaryMCOutcomeLabel =
    isBinaryMC && multiProps
      ? multiProps.answerText ?? multiProps.answerToBuy.text
      : undefined
  const isCashContract = contract.token === 'CASH'

  const quickAddButtonSize =
    liquidityTier === 0 ||
    (contract.mechanism === 'cpmm-multi-1' &&
      liquidityTier === 1 &&
      !contract.shouldAnswersSumToOne)
      ? 'small'
      : undefined

  const initialBetAmount = isCashContract
    ? 1
    : quickAddButtonSize === 'small'
    ? 10
    : 50

  const [betAmount, setBetAmount] = useState<number | undefined>(
    initialBetAmount
  )

  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedBet, setSubmittedBet] = useState<
    | (LimitBet & {
        expired: boolean
        toastId: string
      })
    | null
  >(null)

  const [manaSlippageProtection, setManaSlippageProtection] =
    usePersistentLocalState(false, 'mana-slippage-protection')
  const [cashSlippageProtection, setCashSlippageProtection] =
    usePersistentLocalState(true, 'cash-slippage-protection')
  const slippageProtection = isCashContract
    ? cashSlippageProtection
    : manaSlippageProtection
  const [inputRef, focusAmountInput] = useFocus()

  // State for share row
  const [isSharing, setIsSharing] = useState(false)
  const [lastBetDetails, setLastBetDetails] = useState<Bet | null>(null)

  // State for editing payout
  const [isEditingPayout, setIsEditingPayout] = useState(false)
  const [editablePayout, setEditablePayout] = useState<number | undefined>(
    undefined
  )

  // Timeout reference for dismiss timer
  const [dismissTimeoutRef, setDismissTimeoutRef] =
    useState<NodeJS.Timeout | null>(null)

  const isCpmmMulti = contract.mechanism === 'cpmm-multi-1'
  if (isCpmmMulti && !multiProps) {
    throw new Error('multiProps must be defined for cpmm-multi-1')
  }

  const shouldAnswersSumToOne =
    'shouldAnswersSumToOne' in contract ? contract.shouldAnswersSumToOne : false

  const unfilledBets =
    isCpmmMulti && !shouldAnswersSumToOne
      ? unfilledBetsMatchingAnswer
      : allUnfilledBets

  const isPseudoNumeric = contract.outcomeType === 'PSEUDO_NUMERIC'
  const isStonk = contract.outcomeType === 'STONK'

  const limitBets = useContractBets(
    contract.id,
    removeUndefinedProps({
      userId: user?.id,
      enabled: !!user?.id,
      afterTime: contract?.lastBetTime ?? user?.lastBetTime,
    }),
    useIsPageVisible,
    (params) => api('bets', params)
  )
  const updatedBet = limitBets.find((b) => b.id === submittedBet?.id)
  useEffect(() => {
    if (!submittedBet) return
    if (
      updatedBet?.isFilled ||
      updatedBet?.isCancelled ||
      submittedBet.expired ||
      (updatedBet?.expiresAt && Date.now() > updatedBet.expiresAt)
    ) {
      const amountFilled = updatedBet?.amount ?? submittedBet.amount
      const sharesFilled = updatedBet?.shares ?? submittedBet.shares
      const orderAmount = updatedBet?.orderAmount ?? submittedBet.orderAmount
      toast.success(
        `${formatMoney(amountFilled)}/${formatMoney(
          orderAmount
        )} filled for ${formatMoney(sharesFilled)} payout`,
        {
          duration: 5000,
          id: submittedBet.toastId,
        }
      )
      setSubmittedBet(null)
      setIsSubmitting(false)
      const finalBetDetails = updatedBet ?? submittedBet
      if (finalBetDetails) {
        setLastBetDetails(finalBetDetails)
        setIsSharing(false)
        const timeoutId = setTimeout(() => {
          callOnBuySuccess()
        }, WAIT_TO_DISMISS)
        setDismissTimeoutRef(timeoutId)
      } else {
        setLastBetDetails(null)
        callOnBuySuccess()
      }
    }
  }, [updatedBet, submittedBet])

  const [justSetAdvancedTrader, setJustSetAdvancedTrader] = useState<boolean>(
    user?.isAdvancedTrader ?? false
  )
  const isAdvancedTrader = useIsAdvancedTrader() || justSetAdvancedTrader

  const [betTypeSetting, setBetTypeSetting] = useState<'Market' | 'Limit'>(
    'Market'
  )

  useEffect(() => {
    if (!isAdvancedTrader && betTypeSetting === 'Limit') {
      setBetTypeSetting('Market')
    }
  }, [isAdvancedTrader])

  useEffect(() => {
    if (!isIOS() && !isAndroid()) {
      focusAmountInput()
    }
  }, [])

  function onBetChange(newAmount: number | undefined) {
    setBetAmount(newAmount)
    // Cancel dismiss timer if user is still interacting with the bet panel
    cancelDismissTimerFn()
  }

  const callOnBuySuccess = useEvent(() => {
    if (onBuySuccess && !isSharing) {
      onBuySuccess()
    }
  })

  const {
    currentPayout,
    probAfter: newProbAfter,
    currentReturn,
    betDeps,
    limitProb,
    prob,
    calculationError,
  } = getLimitBetReturns(
    outcome ?? 'YES',
    betAmount ?? 0,
    unfilledBets,
    balanceByUserId,
    contract,
    multiProps,
    undefined,
    slippageProtection
  )
  let probBefore = prob
  let probAfter = newProbAfter
  if (
    multiProps &&
    multiProps.answerToBuy.text !== multiProps.answerText &&
    isBinaryMC
  ) {
    probBefore = 1 - prob
    probAfter = 1 - newProbAfter
  }

  useEffect(() => {
    if (calculationError) {
      setError(calculationError)
    }
  }, [calculationError, error])

  async function submitBet() {
    if (!user || !betAmount) return
    console.log('betDeps', betDeps)
    setError(undefined)
    setIsSubmitting(true)
    const toastId = slippageProtection
      ? toast.loading(`Placing ${TRADE_TERM.toLowerCase()}...`, {
          duration: 10000,
        })
      : undefined

    try {
      const expiresMillisAfter = 1000
      const bet = await api(
        'bet',
        removeUndefinedProps({
          outcome,
          amount: betAmount,
          contractId: contract.id,
          answerId: multiProps?.answerToBuy.id,
          replyToCommentId,
          deps: uniq(betDeps.map((b) => b.userId)),
          expiresMillisAfter: slippageProtection
            ? expiresMillisAfter
            : undefined,
          silent: slippageProtection,
          limitProb: slippageProtection ? limitProb : undefined,
        } as APIParams<'bet'>)
      )
      if (bet.isFilled) {
        if (slippageProtection) {
          toast.success(
            `${formatMoney(bet.amount)}/${formatMoney(
              bet.orderAmount ?? 0
            )} filled for ${formatMoney(bet.shares)} payout`,
            {
              duration: 5000,
              id: toastId,
            }
          )
        }
        setSubmittedBet(null)
        setIsSubmitting(false)

        const fullBet: Bet = {
          ...(bet as CandidateBet<LimitBet>),
          id: bet.betId,
          userId: user.id,
        }
        setLastBetDetails(fullBet)
        setIsSharing(false)
        // TODO: we could remove the timeout and just not dismiss the modal
        const timeoutId = setTimeout(() => {
          callOnBuySuccess()
        }, WAIT_TO_DISMISS)
        setDismissTimeoutRef(timeoutId)
        track(
          'bet',
          removeUndefinedProps({
            location,
            outcomeType: contract.outcomeType,
            token: contract.token,
            slug: contract.slug,
            contractId: contract.id,
            amount: betAmount,
            betGroupId: bet.betGroupId,
            betId: bet.betId,
            outcome,
            isLimitOrder: false,
            answerId: multiProps?.answerToBuy.id,
            feedReason,
            boosted: contract.boosted,
          })
        )
      } else {
        if (!toastId) {
          console.error('No toastId')
          return
        }
        toast.loading(`Filling ${TRADE_TERM.toLowerCase()}...`, {
          duration: expiresMillisAfter + 100,
          id: toastId,
        })
        setSubmittedBet({
          ...(bet as CandidateBet<LimitBet>),
          userId: user.id,
          id: bet.betId,
          expired: false,
          toastId,
        })
        setTimeout(() => {
          setSubmittedBet((prev) => (prev ? { ...prev, expired: true } : null))
        }, expiresMillisAfter + 100)
      }
      setBetAmount(undefined)
    } catch (e) {
      if (e instanceof APIError) {
        const message = e.message.toString()
        if (message.includes('could not serialize access')) {
          setError(`Error placing ${TRADE_TERM} (could not serialize access)`)
          console.error(`Error placing ${TRADE_TERM}`, e)
        } else setError(message)
        toast.error(`Error submitting ${TRADE_TERM}`, { id: toastId })
      } else {
        console.error(e)
        setError(`Error placing ${TRADE_TERM}`)
        toast.error(`Error submitting ${TRADE_TERM}`, { id: toastId })
      }
      setIsSubmitting(false)
      setLastBetDetails(null)
    }
  }
  const [showLocationMonitor, setShowLocationMonitor] = useState(false)

  const { status: verificationStatus, message: verificationMessage } =
    getVerificationStatus(user, privateUser)

  const betDisabled =
    isSubmitting ||
    !betAmount ||
    outcome === undefined ||
    error === 'Insufficient balance' ||
    showLocationMonitor ||
    (isCashContract && verificationStatus !== 'success')

  const limits =
    contract.outcomeType === 'STONK'
      ? { max: MAX_STONK_PROB, min: MIN_STONK_PROB }
      : { max: MAX_CPMM_PROB, min: MIN_CPMM_PROB }
  const maxProb = limits.max
  const minProb = limits.min
  const probStayedSame = formatPercent(probAfter) === formatPercent(probBefore)
  const probChange = Math.abs(probAfter - probBefore)
  const currentReturnPercent = formatPercent(currentReturn)

  const displayedAfter = isPseudoNumeric
    ? formatLargeNumber(probAfter)
    : formatPercent(probAfter)

  const balance = isCashContract ? user?.cashBalance ?? 0 : user?.balance ?? 0

  const bankrollFraction = (betAmount ?? 0) / (balance ?? 1e9)

  // warnings
  const highBankrollSpend =
    (betAmount ?? 0) >= 100 && bankrollFraction >= 0.5 && bankrollFraction <= 1
  const highProbMove =
    (betAmount ?? 0) > 10 && probChange > 0.299 && bankrollFraction <= 1

  const warning = highBankrollSpend
    ? `You might not want to spend ${formatPercent(
        bankrollFraction
      )} of your balance on a single trade. \n\nCurrent balance: ${formatWithToken(
        {
          amount: balance,
          token: isCashContract ? 'CASH' : 'M$',
        }
      )}`
    : highProbMove
    ? `Are you sure you want to move the market to ${displayedAfter}?`
    : undefined

  const choicesMap: { [key: string]: string } = isStonk
    ? { Buy: 'YES', Short: 'NO' }
    : { Yes: 'YES', No: 'NO' }

  const { pseudonymName, pseudonymColor } =
    props.pseudonym?.[outcome as 'YES' | 'NO'] ?? {}

  const shouldPromptVerification =
    isCashContract &&
    PROMPT_USER_VERIFICATION_MESSAGES.includes(verificationMessage)

  const betType = isStonk ? 'Market' : betTypeSetting
  const isMobile = useIsMobile()

  const handlePayoutEdited = useEvent(() => {
    if (
      !outcome ||
      !editablePayout ||
      isNaN(editablePayout) ||
      editablePayout <= 0
    ) {
      setIsEditingPayout(false)
      return
    }

    try {
      const amount = calculateCpmmAmountToBuyShares(
        contract,
        editablePayout,
        outcome,
        allUnfilledBets,
        balanceByUserId,
        multiProps?.answerToBuy
      )

      if (amount && isFinite(amount) && amount > 0) {
        setBetAmount(amount)
        setError(undefined) // Clear potential previous errors
      } else {
        toast.error('Could not calculate bet for that payout amount')
      }
    } catch (err) {
      console.error('Error calculating bet amount from shares:', err)
      toast.error('Error calculating bet amount')
    } finally {
      setIsEditingPayout(false)
    }
  })

  // Cancel dismiss timer function
  const cancelDismissTimerFn = useEvent(() => {
    if (dismissTimeoutRef) {
      clearTimeout(dismissTimeoutRef)
      setDismissTimeoutRef(null)
    }
  })

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef) {
        clearTimeout(dismissTimeoutRef)
      }
    }
  }, [dismissTimeoutRef])

  // Set up the cancel function to be accessible from parent
  useEffect(() => {
    if (cancelDismissTimerRef) {
      cancelDismissTimerRef.current = cancelDismissTimerFn
    }
  }, [cancelDismissTimerRef, cancelDismissTimerFn])

  return (
    <>
      <Col className={clsx(className, 'relative rounded-xl px-4 py-2')}>
        {children}
        {(isAdvancedTrader || alwaysShowOutcomeSwitcher) && (
          <Row className={'mb-2 mt-2 justify-between'}>
            <Row
              className={clsx(
                ' gap-1',
                (isBinaryMC || pseudonymName) && 'invisible'
              )}
            >
              <ChoicesToggleGroup
                currentChoice={outcome}
                color={outcome === 'YES' ? 'light-green' : 'light-red'}
                choicesMap={choicesMap}
                setChoice={(outcome) => {
                  setOutcome(outcome as 'YES' | 'NO')
                  // Cancel dismiss timer if user is switching outcomes
                  cancelDismissTimerFn()
                }}
              />
            </Row>
            <Row className="items-center justify-end gap-2">
              {isAdvancedTrader && !isStonk && (
                <ChoicesToggleGroup
                  currentChoice={betType}
                  color="gray"
                  choicesMap={{
                    Quick: 'Market',
                    Limit: 'Limit',
                  }}
                  setChoice={(val) => {
                    setBetTypeSetting(val as 'Market' | 'Limit')
                  }}
                />
              )}
              {onClose && (
                <Button
                  color="gray-white"
                  size="sm"
                  onClick={onClose}
                  className="-mr-2"
                >
                  <XIcon className="h-5 w-5" />
                </Button>
              )}
            </Row>
          </Row>
        )}
        {betType === 'Market' ? (
          <>
            <Row
              className={clsx('text-ink-600 mb-2 items-center justify-between')}
            >
              <div className="space-x-3">{capitalize(TRADE_TERM)} amount</div>
              {!isAdvancedTrader && onClose && (
                <Button
                  color="gray-white"
                  size="sm"
                  onClick={onClose}
                  className="-mr-2"
                >
                  <XIcon className="h-5 w-5" />
                </Button>
              )}
            </Row>

            <Row
              className={clsx(
                'mb-2 flex-wrap gap-x-8 gap-y-4',
                isAdvancedTrader ? 'items-center' : 'items-end'
              )}
            >
              <BuyAmountInput
                parentClassName="max-w-full"
                amount={betAmount}
                onChange={onBetChange}
                error={error}
                setError={setError}
                disabled={isSubmitting}
                inputRef={inputRef}
                showSlider={true}
                token={isCashContract ? 'CASH' : 'M$'}
                sliderColor={pseudonymColor}
                disregardUserBalance={shouldPromptVerification}
                quickButtonAmountSize={quickAddButtonSize}
              />

              {isAdvancedTrader && (
                <Col className="w-full gap-1">
                  <Row className="w-full items-baseline justify-between sm:justify-start">
                    <span className="text-ink-600 mr-2 min-w-[120px] whitespace-nowrap">
                      {isPseudoNumeric
                        ? 'Estimated value'
                        : isStonk
                        ? 'New stock price'
                        : 'New probability'}
                    </span>
                    <Row className="items-baseline gap-1">
                      <span className="text-lg font-semibold">
                        {getFormattedMappedValue(
                          contract,
                          probStayedSame ? probBefore : probAfter
                        )}
                      </span>
                      {!probStayedSame && !isPseudoNumeric && (
                        <>
                          <span className={clsx('ml-1', 'text-ink-600')}>
                            {outcome !== 'NO' || isBinaryMC ? '↑' : '↓'}
                            {getFormattedMappedValue(
                              contract,
                              Math.abs(probAfter - probBefore)
                            )}
                            {floatingEqual(probAfter, maxProb)
                              ? ' (max)'
                              : floatingEqual(probAfter, minProb)
                              ? ' (max)'
                              : ''}
                          </span>

                          <button
                            onClick={() => {
                              toast.success(
                                `Slippage protection on ${
                                  isCashContract ? 'cash' : 'mana'
                                } questions ${
                                  !slippageProtection ? 'enabled' : 'disabled'
                                }!`
                              )
                              if (isCashContract) {
                                setCashSlippageProtection(
                                  !cashSlippageProtection
                                )
                              } else {
                                setManaSlippageProtection(
                                  !manaSlippageProtection
                                )
                              }
                            }}
                            className="self-center"
                          >
                            <Tooltip
                              autoHideDuration={isMobile ? 3000 : undefined}
                              text={
                                slippageProtection
                                  ? `Your trades won't move the question probability more than 10 percentage points from displayed probability.`
                                  : `Slippage protection on ${
                                      isCashContract ? 'cash' : 'mana'
                                    } questions is off.`
                              }
                            >
                              {slippageProtection ? (
                                <LockClosedIcon className="h-4 w-4 text-indigo-300 hover:text-indigo-400" />
                              ) : (
                                <LockOpenIcon className="text-ink-500 hover:text-ink-600 h-4 w-4" />
                              )}
                            </Tooltip>
                          </button>
                        </>
                      )}
                    </Row>
                  </Row>
                  <Row className="min-w-[128px] items-baseline justify-between sm:justify-start">
                    <div className="text-ink-600 mr-2 min-w-[120px] flex-nowrap whitespace-nowrap">
                      {isPseudoNumeric || isStonk ? 'Shares' : <>To win</>}
                    </div>
                    <Row className="items-baseline">
                      <span className="mr-1 whitespace-nowrap text-lg">
                        {isStonk ? (
                          getStonkDisplayShares(contract, currentPayout, 2)
                        ) : isPseudoNumeric ? (
                          Math.floor(currentPayout)
                        ) : (
                          <>
                            {isEditingPayout ? (
                              <AmountInput
                                inputClassName="w-32"
                                onBlur={handlePayoutEdited}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handlePayoutEdited()
                                  } else if (e.key === 'Escape') {
                                    setIsEditingPayout(false)
                                  }
                                }}
                                autoFocus
                                min={1}
                                step={1}
                                amount={editablePayout}
                                onChangeAmount={setEditablePayout}
                              />
                            ) : (
                              <span
                                className={clsx(
                                  'cursor-pointer hover:underline'
                                )}
                                onClick={() => {
                                  setEditablePayout(Math.floor(currentPayout))
                                  setIsEditingPayout(true)
                                }}
                              >
                                {formatWithToken({
                                  amount: currentPayout,
                                  token: 'M$',
                                })}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                      <span className="text-green-500 ">
                        {isStonk || isPseudoNumeric
                          ? ''
                          : ' +' + currentReturnPercent}
                      </span>
                    </Row>
                  </Row>
                </Col>
              )}
            </Row>
          </>
        ) : (
          <>
            <LimitOrderPanel
              betAmount={betAmount}
              contract={contract}
              multiProps={multiProps}
              user={user}
              unfilledBets={unfilledBets}
              balanceByUserId={balanceByUserId}
              outcome={outcome}
              pseudonym={props.pseudonym}
            />
          </>
        )}

        {betType !== 'Limit' && (
          <Col className="gap-2">
            {user ? (
              shouldPromptVerification ? (
                <span className="text-error">
                  New sweepstakes signups disabled{' '}
                </span>
              ) : (
                <>
                  <LocationMonitor
                    contract={contract}
                    user={user}
                    setShowPanel={setShowLocationMonitor}
                    showPanel={showLocationMonitor}
                  />
                  {isCashContract && verificationStatus !== 'success' && (
                    <div className="text-error">{verificationMessage}</div>
                  )}
                  <WarningConfirmationButton
                    marketType="binary"
                    amount={betAmount}
                    warning={warning}
                    userOptedOutOfWarning={user.optOutBetWarnings}
                    onSubmit={submitBet}
                    ButtonClassName={clsx('flex-grow')}
                    actionLabelClassName={'line-clamp-1'}
                    isSubmitting={isSubmitting}
                    disabled={betDisabled}
                    size="xl"
                    color={
                      pseudonymColor ??
                      binaryMCColors?.[outcome == 'YES' ? 0 : 1] ??
                      (outcome === 'NO' ? 'red' : 'green')
                    }
                    actionLabel={
                      betDisabled && !outcome ? (
                        `Select ${formatOutcomeLabel(
                          contract,
                          'YES'
                        )} or ${formatOutcomeLabel(contract, 'NO')}`
                      ) : isStonk ? (
                        <span>
                          {formatOutcomeLabel(contract, outcome, pseudonymName)}{' '}
                          <MoneyDisplay
                            amount={betAmount ?? 0}
                            isCashContract={isCashContract}
                          />
                        </span>
                      ) : (
                        <span>
                          Buy{' '}
                          {binaryMCOutcomeLabel ??
                            formatOutcomeLabel(
                              contract,
                              outcome,
                              pseudonymName
                            )}{' '}
                          to win{' '}
                          <MoneyDisplay
                            amount={currentPayout}
                            isCashContract={isCashContract}
                          />
                        </span>
                      )
                    }
                    inModal={!!onClose}
                  />
                </>
              )
            ) : (
              <Button
                color={outcome === 'NO' ? 'red' : 'green'}
                size="xl"
                onClick={withTracking(firebaseLogin, 'login from bet panel', {
                  token: contract.token,
                })}
                className="mb-2 flex-grow"
              >
                Sign up to {TRADE_TERM}
              </Button>
            )}
          </Col>
        )}
        {lastBetDetails && (
          <Row className="bg-primary-100 mt-2 items-center justify-between rounded-lg p-3">
            <Row className="items-baseline gap-2">
              <span className="text-primary-700 text-sm ">
                {isSubmitting ? 'Placing trade...' : 'Trade successful!'}
              </span>
            </Row>
            <Button
              className="w-1/2"
              color="gradient"
              onClick={() => setIsSharing(true)}
            >
              <Row className="items-center gap-1.5">
                <LuShare className="h-5 w-5" aria-hidden />
                Share Bet
              </Row>
            </Button>
          </Row>
        )}

        {lastBetDetails && isSharing && user && (
          <ShareBetModal
            open={isSharing}
            setOpen={setIsSharing}
            questionText={contract.question}
            outcome={formatOutcomeLabel(
              contract,
              lastBetDetails.outcome as 'YES' | 'NO'
            )}
            answer={multiProps?.answerToBuy.text}
            avgPrice={formatPercent(
              lastBetDetails.outcome === 'YES'
                ? lastBetDetails.amount / lastBetDetails.shares
                : 1 - lastBetDetails.amount / lastBetDetails.shares
            )}
            betAmount={lastBetDetails.amount}
            winAmount={lastBetDetails.shares}
            bettor={{
              id: user.id,
              name: user.name,
              username: user.username,
              avatarUrl: user.avatarUrl,
            }}
            isLimitBet={lastBetDetails.limitProb !== undefined}
            orderAmount={lastBetDetails.orderAmount}
          />
        )}

        {user && (
          <Row className="mt-5 items-start justify-between text-sm">
            <Row className={''}>
              <span
                className={clsx(
                  'text-ink-600 mr-1 whitespace-nowrap ',
                  isAdvancedTrader ? '' : 'min-w-[110px]'
                )}
              >
                Your mana balance
              </span>
              <span className="text-ink-600 font-semibold">
                <MoneyDisplay
                  amount={balance}
                  isCashContract={isCashContract}
                />
              </span>
            </Row>
          </Row>
        )}

        {!isAdvancedTrader && (
          <Col>
            <Row className="">
              <span className="text-ink-600 mr-1 min-w-[110px] whitespace-nowrap text-sm">
                {isPseudoNumeric
                  ? 'Estimated value'
                  : isStonk
                  ? 'New stock price'
                  : 'New probability'}
              </span>

              <span className="text-ink-600 text-sm font-semibold">
                {getFormattedMappedValue(
                  contract,
                  probStayedSame ? probBefore : probAfter
                )}
              </span>
              {!probStayedSame && !isPseudoNumeric && (
                <span className={clsx('ml-2 text-sm', 'text-ink-600')}>
                  {outcome !== 'NO' || isBinaryMC ? '↑' : '↓'}
                  {getFormattedMappedValue(
                    contract,
                    Math.abs(probAfter - probBefore)
                  )}
                  {floatingEqual(probAfter, maxProb)
                    ? ' (max)'
                    : floatingEqual(probAfter, minProb)
                    ? ' (max)'
                    : ''}{' '}
                </span>
              )}

              {!isPseudoNumeric && !isStonk && !isBinaryMC && (
                <InfoTooltip
                  text={`Your ${TRADE_TERM} will move the probability of Yes from ${getFormattedMappedValue(
                    contract,
                    probBefore
                  )} to ${getFormattedMappedValue(contract, probAfter)}.`}
                  className="text-ink-600 ml-1 mt-0.5"
                  size="sm"
                />
              )}

              {isBinaryMC && (
                <InfoTooltip
                  text={`Your ${TRADE_TERM} will move the probability from ${getFormattedMappedValue(
                    contract,
                    probBefore
                  )} to ${getFormattedMappedValue(contract, probAfter)}.`}
                  className="text-ink-600 ml-1 mt-0.5"
                  size="sm"
                />
              )}
            </Row>
          </Col>
        )}

        {user && (
          <div className="absolute bottom-2 right-0">
            <button
              className="text-ink-600 mr-2 flex items-center text-sm hover:underline"
              onClick={() => {
                if (!isAdvancedTrader) {
                  setBetTypeSetting('Market')
                }
                api('me/update', { isAdvancedTrader: !isAdvancedTrader })
                setJustSetAdvancedTrader(!isAdvancedTrader)
              }}
            >
              <span className="hover:underline">
                {isAdvancedTrader ? 'Basic' : 'Advanced'}
              </span>
              <ChevronDownIcon className="ml-1 h-3 w-3" />
            </button>
          </div>
        )}
      </Col>

      {contract.mechanism === 'cpmm-multi-1' && (
        <YourOrders
          className="mt-2 rounded-lg bg-indigo-200/10 py-4"
          contract={contract}
          bets={unfilledBetsMatchingAnswer}
        />
      )}
      {isAdvancedTrader && (
        <OrderBookPanel
          contract={contract}
          limitBets={unfilledBets.filter(
            (b) => b.answerId === multiProps?.answerToBuy?.id
          )}
          answer={multiProps?.answerToBuy}
          pseudonym={props.pseudonym}
        />
      )}
    </>
  )
}

export const QuickBetAmountsRow = (props: {
  onAmountChange: (amount: number) => void
  betAmount: number | undefined
  className?: string
}) => {
  const { onAmountChange, betAmount, className } = props
  const QUICK_BET_AMOUNTS = [10, 25, 100]
  return (
    <Row className={clsx('mb-2 items-center space-x-3', className)}>
      <div className="text-ink-600">Amount</div>
      <ChoicesToggleGroup
        currentChoice={
          QUICK_BET_AMOUNTS.includes(betAmount ?? 0) ? betAmount : undefined
        }
        choicesMap={QUICK_BET_AMOUNTS.reduce<{
          [key: number]: number
        }>((map, amount) => {
          map[amount] = amount
          return map
        }, {})}
        setChoice={(amount) => {
          if (typeof amount === 'number') {
            onAmountChange(amount)
          }
        }}
      />
    </Row>
  )
}
