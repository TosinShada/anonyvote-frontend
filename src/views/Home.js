import { Fragment, useState, useEffect } from "react"

import {
    Card,
    CardImg,
    CardBody,
    Row,
    Col,
    CardTitle,
    CardText,
    Modal,
    Input,
    Label,
    Button,
    ModalBody,
    ModalHeader,
    FormFeedback
} from "reactstrap"
import Poll from "react-polls"
import path from "path"

// ** Custom Components
import Breadcrumbs from "../utility/breadcrumbs"

import { getPolls } from "../services/apiCalls"

import img1 from "@src/assets/images/slider/06.jpg"
import CreatePoll from "./CreatePoll"
import {
    getIdentityCommitments,
    connectContract,
    packProof,
    broadcastSignal,
    voteOption
} from "../services/logic"
import { Semaphore, generateMerkleProof } from "@libsem/protocols"
import { handleError, handleLoading, handleSuccess } from "../utility/alert"
import { retrieveId } from "../utility/storage"

const Home = () => {
    // ** States
    const [data, setData] = useState([])
    const [show, setShow] = useState(false)

    const ZERO_VALUE = 56568702409114342732388388764660722017601642515166106701650971766248247995328n

    useEffect(() => {
        getPolls().then((polls) => {
            setData(polls.data.data)
        })
    }, [])

    connectContract()

    // Handling user vote
    const handleVote = async (voteAnswer, options, pollHash, pollId) => {
        const pollAnswer = options.find(
            (answer) => answer.option === voteAnswer
        )
        const newVotes = pollAnswer.votes + 1
        handleLoading()
        const signal = pollAnswer.signal
        const externalNullifier = pollHash
        const identityCommitments = await getIdentityCommitments()
        const identity = retrieveId()
        const treeDepth = 20
        const identityCommitment = identity.identityCommitment

        const nullifierHash = Semaphore.genNullifierHash(
            externalNullifier,
            identity.identityNullifier,
            treeDepth
        )

        const merkleProof = generateMerkleProof(
            treeDepth,
            ZERO_VALUE,
            5,
            identityCommitments,
            identityCommitment
        )

        const serializedIdentity = {
            identityNullifier: identity.identityNullifier,
            identityTrapdoor: identity.identityTrapdoor
        }

        const witness = Semaphore.genWitness(
            serializedIdentity,
            merkleProof,
            externalNullifier,
            signal
        )

        const wasmFilePath = path.join("/static", "semaphore.wasm")
        const finalZkeyPath = path.join("/static", "semaphore_final.zkey")

        const fullProof = await Semaphore.genProof(
            witness,
            wasmFilePath,
            finalZkeyPath
        )
        
        const solidityProof = Semaphore.packToSolidityProof(fullProof)

        const packedProof = await packProof(solidityProof)

        const intProofs = []
        let intProof
        packedProof.map((proof) => {
            intProof = BigInt(proof)
            intProofs.push(intProof)
            return intProofs
        })

        const isValidBroadcast = await broadcastSignal(
            signal,
            intProofs,
            merkleProof.root,
            nullifierHash,
            externalNullifier
        )

        if (isValidBroadcast) {
            await voteOption(options, voteAnswer, pollId, newVotes)
            handleSuccess()
        } else {
            handleError()
        }
    }

    const renderPolls = () => {
        if (data.length) {
            return data.map((poll) => {
                return (
                    <Col key={poll._id}>
                        <Card className='mb-3'>
                            <CardImg top src={img1} alt='card-top' />
                            <CardBody>
                                <CardTitle tag='h4'>{poll.title}</CardTitle>
                                <CardText>{poll.description}</CardText>
                                <CardText>
                                    <small className='text-muted'>
                                        {`Expires: ${poll.expiry}`}
                                    </small>
                                </CardText>
                                <Poll
                                    question={poll._id}
                                    answers={poll.options}
                                    onVote={(voteAnswer) => handleVote(
                                            voteAnswer,
                                            poll.options,
                                            poll.hash,
                                            poll._id
                                        )
                                    }
                                    customStyles={{ theme: "blue" }}
                                />
                            </CardBody>
                        </Card>
                    </Col>
                )
            })
        }
    }

    return (
        <Fragment>
            <Breadcrumbs
                breadCrumbTitle='Anonymous Polls'
                breadCrumbParent='Vote'
                setShow={setShow}
            />

            <Row md='3' sm='2' xs='1'>
                {" "}
                {renderPolls()}
            </Row>
            <Modal
                isOpen={show}
                toggle={() => setShow(!show)}
                className='modal-dialog-centered modal-lg'
            >
                <ModalHeader
                    className='bg-transparent'
                    toggle={() => setShow(!show)}
                ></ModalHeader>
                <ModalBody className='px-sm-5 mx-50 pb-5'>
                    <div className='text-center mb-2'>
                        <h1 className='mb-1'>Add a New Poll</h1>
                    </div>
                    <CreatePoll setShow={setShow} />
                </ModalBody>
            </Modal>
        </Fragment>
    )
}

export default Home
