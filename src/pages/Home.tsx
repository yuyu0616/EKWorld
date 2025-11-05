import { useNavigate } from 'react-router-dom';
import { Card, CardActionArea } from '@mui/material';
import { useState } from 'react';
import { isMobile } from 'react-device-detect';
import './../css/App.css';
import './../css/Home.css';

function Home() {
    const navigate = useNavigate();
    const handleClick = (url: string) => {
        navigate(url);
    }

    const [isMenuClick, setMenuClick] = useState<number | null>(null);

    const animationDelay = (action: () => void) => {
        setTimeout(() => {
            action();
        }, 1000);
    }

    return (
        <div
            className="body"
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: 8,
                }}
            >
                {
                    [
                        { name: "ルーレット", link: "/roulette" }
                    ].map((m, i) => {
                        return (
                            <Card
                                className={isMenuClick === null ? '' : isMenuClick !== i ? 'home-menu' : ''}
                                onClick={() => {
                                    setMenuClick(i);
                                    animationDelay(() => handleClick(m.link))
                                }}
                                style={{
                                    ...cardStyle
                                }}
                                key={`menu_${m.name}`}
                            >
                                <CardActionArea
                                    style={{
                                        ...cardAreaStyle
                                    }}
                                    onClick={() => handleClick(m.link)}>
                                    {m.name}
                                </CardActionArea>
                            </Card>
                        )
                    })
                }
            </div>
        </div>
    );
}

const cardStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: isMobile ? "100%" : "30%",
    height: 128,
    maxWidth: 256,
    minWidth: 256,
    margin: 8,
    fontSize: 24,
    fontWeight: "bold",
}

const cardAreaStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    height: "100%",
}

export default Home;