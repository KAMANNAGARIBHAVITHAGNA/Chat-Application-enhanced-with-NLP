import React, { useEffect, useState, useRef } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import './Chat.css';
import { Chatbox } from './chatbox/Chatbox';
import { Userslist } from './userslist/Userslist';
import { Sentiment } from './sentiment/Sentiment';

import io from "socket.io-client";

const ENDPOINT = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:8000/';
console.log('Connecting to:', ENDPOINT);

interface Message {
    body: string;
    id: string;
    username: string;
    tone?: string;
}

interface Props {

}

export function Chat(props: Props) {
    const [Username, setUsername] = useState<string>("");
    const [EnteredUsername, setEnteredUsername] = useState<number>(0);

    const [YourID, setYourID] = useState<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [message, setMessage] = useState<string>("");
    const [users, setUsers] = useState<string[]>([]);
    const [sentiment, setSentiment] = useState<number>(0.5);

    const socketRef = useRef<ReturnType<typeof io> | null>(null);

    useEffect(() => {

        // Make socket connection
        socketRef.current = io(ENDPOINT, { transports: ['websocket'] });

        // Get id from server
        socketRef.current.on('your id', (id: string) => {
            // Get current socket connection id
            setYourID(id);
        });

        // Get messages from server
        socketRef.current.on('message', (message: Message) => {
            recievedMessage(message);
        });

        // Handle tone updates for existing messages
        socketRef.current.on('message update', (update: { id: string, tone: string }) => {
            setMessages(oldMessages => 
                oldMessages.map(msg => 
                    msg.id === update.id ? { ...msg, tone: update.tone } : msg
                )
            );
        });

        // Get online users from server
        socketRef.current.on('get users', (users: string[]) => {
            console.log(users);
            setUsers(users);
        });

        // Get updated sentiment from server
        socketRef.current.on('get sentiment', (sentiment: number) => {
            setSentiment(sentiment);
        });

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };

    }, []);

    useEffect(() => {

        // Once user enters the room
        if (EnteredUsername && socketRef.current) {
            // Tell server about me
            socketRef.current.emit('new user', { Username: Username });
        }

    }, [EnteredUsername, Username]);

    function recievedMessage(message: Message) {
        setMessages(oldMessages => [...oldMessages, message]);
    }

    function sendMessage(event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>) {
        console.log("here")
        event.preventDefault();
        const messageObject: Message = {
            body: message,
            id: YourID,
            username: Username
        };
        setMessage("");

        // Send new chat message to server
        if (socketRef.current) {
            socketRef.current.emit("send message", messageObject);
        }
    }

    return (
        <div className="main-section">


            {
                EnteredUsername

                    ?

                    <Container>
                        <h3>Welcome, {Username}!</h3>
                        <Row md={2}>
                            <Col>
                                <Userslist users={users} />
                            </Col>
                            <Col>
                                <Sentiment sentiment={sentiment} />
                            </Col>
                        </Row>
                        <Row>
                            <Col>
                                <Chatbox YourID={YourID} messages={messages} message={message} setMessage={setMessage} sendMessage={sendMessage} />
                            </Col>
                        </Row>
                    </Container>

                    :

                    <Container>
                        <form>
                            <Row>
                                <Col>
                                    Enter Username:
                            </Col>
                            </Row>
                            <Row>
                                <Col>
                                    <input className="username-input" type="text" name="name" onChange={e => setUsername(e.target.value)} />
                                </Col>
                            </Row>
                            <Row>
                                <Col>
                                    <button className="submit-button" onClick={e => setEnteredUsername(1)}>Submit</button>
                                </Col>
                            </Row>
                        </form>
                    </Container>
            }


        </div>
    );
}